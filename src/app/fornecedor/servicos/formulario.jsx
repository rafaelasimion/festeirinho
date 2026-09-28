'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Campo from '@/componentes/campo';
import GerenciarFotos from '@/componentes/gerenciar-fotos';
import { ROTULO_COBRANCA } from '@/lib/solicitacao';

const CAMPOS_VAZIOS = {
  nome: '',
  descricao: '',
  idCategoria: '',
  idCobranca: '',
  precoBase: '',
  capacidadeMax: '',
  diasAntecedencia: '',
};

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white pl-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

// O formulário em si. Sem ?novo nem ?editar não há o que fazer nesta
// tela, e o fluxo volta para a vitrine.
export default function FormularioServico() {
  const parametros = useSearchParams();
  const router = useRouter();
  const [servicos, setServicos] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'novo' | id do serviço
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregarServicos() {
    const resposta = await fetch('/api/fornecedor/servicos');
    if (resposta.status === 401) {
      router.push('/login');
      return;
    }
    if (!resposta.ok) {
      setErroGeral('Não foi possível carregar seus serviços.');
      return;
    }
    setServicos(await resposta.json());
  }

  useEffect(() => {
    async function carregarTudo() {
      try {
        const respostaOpcoes = await fetch('/api/opcoes');
        if (respostaOpcoes.ok) {
          setOpcoes(await respostaOpcoes.json());
        } else {
          setErroGeral('Não foi possível carregar categorias e formas de cobrança.');
        }
        await carregarServicos();
      } catch {
        setErroGeral('Falha de conexão.');
      }
    }
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre o formulário assim que os dados chegam. Depende de `servicos`
  // porque editar precisa do serviço carregado para preencher os campos.
  useEffect(() => {
    if (servicos === null || opcoes === null || editando !== null) return;

    if (parametros.get('novo') !== null) {
      abrirNovo();
      return;
    }

    const idEditar = Number(parametros.get('editar'));
    if (Number.isInteger(idEditar)) {
      const servico = servicos.find((s) => s.id === idEditar);
      if (servico) {
        abrirEdicao(servico);
        return;
      }
    }

    // Nem cadastro nem edição: não há tela aqui.
    router.replace('/fornecedor/vitrine');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos, opcoes]);

  const antecedenciaMinima = opcoes?.antecedenciaMinimaDias ?? 1;

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setMensagem('');
  }

  function abrirNovo() {
    setCampos({
      ...CAMPOS_VAZIOS,
      diasAntecedencia: String(opcoes?.antecedenciaMinimaDias ?? ''),
    });
    setErros({});
    setMensagem('');
    setEditando('novo');
  }

  function abrirEdicao(servico) {
    setCampos({
      nome: servico.nome,
      descricao: servico.descricao,
      idCategoria: String(servico.id_categoria),
      idCobranca: String(servico.id_cobranca),
      precoBase: String(servico.preco_base),
      capacidadeMax: servico.capacidade_max === null ? '' : String(servico.capacidade_max),
      diasAntecedencia: String(servico.dias_antecedencia),
    });
    setErros({});
    setMensagem('');
    setEditando(servico.id);
  }

  async function salvar() {
    setErros({});
    setErroGeral('');
    setMensagem('');
    setSalvando(true);

    const ehNovo = editando === 'novo';
    const corpo = {
      ...campos,
      idCategoria: Number(campos.idCategoria),
      idCobranca: Number(campos.idCobranca),
      precoBase: Number(campos.precoBase),
      diasAntecedencia: Number(campos.diasAntecedencia),
      capacidadeMax: campos.capacidadeMax === '' ? null : Number(campos.capacidadeMax),
    };

    try {
      const resposta = await fetch(
        ehNovo ? '/api/fornecedor/servicos' : `/api/fornecedor/servicos/${editando}`,
        {
          method: ehNovo ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
        }
      );

      const dados = await resposta.json();

      if (resposta.ok) {
        if (ehNovo) {
          // UC 008, passo 4 — as fotos fazem parte do cadastro, mas só podem
          // ser penduradas num serviço que já existe. Então o formulário
          // continua aberto, agora em modo de edição, com as fotos liberadas.
          setEditando(dados.id);
          setMensagem('Serviço cadastrado. Agora adicione as fotos — a primeira vira a principal.');
        } else {
          setEditando(null);
          setMensagem(
            dados.voltouParaVerificacao
              ? 'Serviço salvo. Como você mudou nome, descrição, categoria ou preço, ele saiu da vitrine até a nova aprovação.'
              : 'Serviço salvo.'
          );
        }
        await carregarServicos();
        return;
      }

      if (dados.erros) setErros(dados.erros);
      else setErroGeral(dados.erro ?? 'Não foi possível salvar.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }


  if (servicos === null || opcoes === null) {
    return <main className="mx-auto max-w-2xl p-6"><p className="text-sm">Carregando...</p></main>;
  }

  const editandoExistente = typeof editando === 'number';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/fornecedor/vitrine"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para a vitrine
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-semibold text-slate-900">
        {editando === 'novo' ? 'Novo serviço' : 'Editar serviço'}
      </h1>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-perigo-600">{erroGeral}</p>}

      {editando !== null && (
        <div className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <Campo label="Nome do serviço" name="nome" value={campos.nome}
            onChange={aoDigitar} erro={erros.nome}
            validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome do serviço.'} />

          <div>
            <label htmlFor="descricao" className="mb-1.5 block text-sm font-medium text-slate-700">
              Descrição
            </label>
            <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
              onChange={aoDigitar}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
            <p className="mt-1 text-xs text-slate-500">
              {campos.descricao.trim().length}/20 caracteres mínimos.
            </p>
            {erros.descricao && <p className="mt-1 text-sm text-perigo-600">{erros.descricao}</p>}
          </div>

          <div>
            <label htmlFor="idCategoria" className="mb-1.5 block text-sm font-medium text-slate-700">
              Categoria
            </label>
            <select id="idCategoria" name="idCategoria" value={campos.idCategoria}
              onChange={aoDigitar} className={CLASSE_SELECT}>
              <option value="">Selecione</option>
              {opcoes?.categorias?.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
              ))}
            </select>
            {erros.idCategoria && <p className="mt-1 text-sm text-perigo-600">{erros.idCategoria}</p>}
          </div>

          <div>
            <label htmlFor="idCobranca" className="mb-1.5 block text-sm font-medium text-slate-700">
              Forma de cobrança
            </label>
            <select id="idCobranca" name="idCobranca" value={campos.idCobranca}
              onChange={aoDigitar} className={CLASSE_SELECT}>
              <option value="">Selecione</option>
              {opcoes?.cobrancas?.map((cobranca) => (
                <option key={cobranca.id} value={cobranca.id}>
                  {ROTULO_COBRANCA[cobranca.descricao]}
                </option>
              ))}
            </select>
            {erros.idCobranca && <p className="mt-1 text-sm text-perigo-600">{erros.idCobranca}</p>}
          </div>

          <Campo label="Preço base (R$)" name="precoBase" type="number" step="0.01" min="0.01"
            value={campos.precoBase} onChange={aoDigitar} erro={erros.precoBase}
            validar={(v) => Number(v) > 0 ? null : 'Informe um preço maior que zero.'} />

          <Campo label="Capacidade máxima de convidados" name="capacidadeMax" type="number" min="1"
            value={campos.capacidadeMax} onChange={aoDigitar} erro={erros.capacidadeMax}
            dica="Deixe em branco se não houver limite."
            validar={(v) => v === '' || Number(v) > 0
              ? null
              : 'Informe uma capacidade maior que zero ou deixe em branco.'} />

          <Campo label="Antecedência mínima (dias)" name="diasAntecedencia" type="number"
            min={antecedenciaMinima}
            value={campos.diasAntecedencia} onChange={aoDigitar} erro={erros.diasAntecedencia}
            dica={`Mínimo permitido pela plataforma: ${opcoes ? antecedenciaMinima : '...'} dias.`}
            validar={(v) => Number(v) >= antecedenciaMinima
              ? null
              : `A antecedência mínima permitida é de ${antecedenciaMinima} dias.`} />

          {/* RF012 — fotos, na mesma tela da edição. Só aparecem quando o
              serviço já existe; num serviço novo, logo depois de salvar. */}
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-1 text-sm font-medium text-slate-700">Fotos</p>
            {editandoExistente ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  As alterações nas fotos são salvas na hora, sem precisar clicar em Salvar.
                </p>
                <GerenciarFotos idServico={editando} aoAlterar={carregarServicos} />
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Salve o serviço para adicionar as fotos.
              </p>
            )}
          </div>

          <div className="flex gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={salvar} disabled={salvando}
              className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => router.push('/fornecedor/vitrine')}
              className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
              {editandoExistente ? 'Concluir' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
