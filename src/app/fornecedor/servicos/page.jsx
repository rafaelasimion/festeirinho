'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Image as ImageIcon, Plus } from 'lucide-react';
import Campo from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import GerenciarFotos from '@/componentes/gerenciar-fotos';
import {
  formatarPreco,
  ROTULO_COBRANCA,
  ROTULO_VERIFICACAO,
  TOM_VERIFICACAO,
} from '@/lib/solicitacao';

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
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

// Sufixo curto do preço no card, como no protótipo: "R$ 95/pessoa".
const SUFIXO_CURTO = { hora: '/hora', pessoa: '/pessoa', fixo: '' };

export default function MeusServicos() {
  const router = useRouter();
  const [servicos, setServicos] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'novo' | id do serviço
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [alternando, setAlternando] = useState(null); // id do serviço

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
    // Leva o formulário, que fica no topo, para dentro da tela.
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async function alternarAtivo(servico) {
    const acao = servico.status_servico === 'ativo' ? 'inativar' : 'reativar';
    setErroGeral('');
    setMensagem('');
    setAlternando(servico.id);
    try {
      const resposta = await fetch(`/api/fornecedor/servicos/${servico.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json();
        setErroGeral(dados.erro ?? 'Não foi possível alterar o serviço.');
        return;
      }
      setMensagem(acao === 'inativar'
        ? `${servico.nome} foi inativado e saiu da vitrine.`
        : `${servico.nome} foi reativado.`);
      await carregarServicos();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setAlternando(null);
    }
  }

  if (servicos === null) {
    return <main className="mx-auto max-w-2xl p-6"><p className="text-sm">Carregando...</p></main>;
  }

  const editandoExistente = typeof editando === 'number';

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Meus serviços</h1>
        {editando === null && (
          <button type="button" onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-festa-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-festa-700">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo serviço
          </button>
        )}
      </div>

      {mensagem && <p className="mb-4 text-sm text-sucesso-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-red-600">{erroGeral}</p>}

      {editando !== null && (
        <div className="mb-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-900">
            {editando === 'novo' ? 'Novo serviço' : 'Editar serviço'}
          </h2>

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
            {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
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
            {erros.idCategoria && <p className="mt-1 text-sm text-red-600">{erros.idCategoria}</p>}
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
            {erros.idCobranca && <p className="mt-1 text-sm text-red-600">{erros.idCobranca}</p>}
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
            <button type="button" onClick={() => setEditando(null)}
              className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
              {editandoExistente ? 'Fechar' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {servicos.length === 0 ? (
        <p className="text-sm text-slate-600">
          Você ainda não cadastrou nenhum serviço.
        </p>
      ) : (
        <ul className="space-y-4">
          {servicos.map((servico) => {
            const ativo = servico.status_servico === 'ativo';

            return (
              <li key={servico.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex gap-4">
                  {/* Miniatura: a foto principal, ou o espaço reservado. */}
                  <div className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                    servico.foto_principal ? '' : 'border-2 border-dashed border-festa-300 bg-festa-50'}`}>
                    {servico.foto_principal ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={servico.foto_principal} alt=""
                        className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-festa-600" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-slate-900">{servico.nome}</h3>
                      <button type="button" onClick={() => abrirEdicao(servico)}
                        aria-label={`Editar ${servico.nome}`}
                        className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-festa-600 transition-colors hover:bg-festa-50">
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-600">{servico.categoria}</span>
                      <Etiqueta tom={TOM_VERIFICACAO[servico.status_verificacao]} contorno>
                        {ROTULO_VERIFICACAO[servico.status_verificacao]}
                      </Etiqueta>
                    </div>

                    <p className="mt-1.5">
                      <span className="text-lg font-semibold text-festa-700">
                        {formatarPreco(servico.preco_base)}
                      </span>
                      <span className="text-sm text-slate-600">{SUFIXO_CURTO[servico.cobranca]}</span>
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      antecedência de {servico.dias_antecedencia} dias
                      {servico.capacidade_max !== null && ` · até ${servico.capacidade_max} convidados`}
                    </p>
                  </div>
                </div>

                {servico.status_verificacao === 'pendente' && (
                  <p className="mt-3 rounded-lg bg-atencao-50 p-3 text-sm text-slate-700">
                    Este serviço está em análise e aparece na vitrine assim que a equipe aprovar.
                  </p>
                )}

                {servico.motivo_rejeicao && servico.status_verificacao === 'rejeitado' && (
                  <div className="mt-3 rounded-lg bg-perigo-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
                      Motivo da recusa
                    </p>
                    <p className="mt-1 text-slate-700">{servico.motivo_rejeicao}</p>
                  </div>
                )}

                {/* UC 010 — ativar/desativar. Um interruptor, como no
                    protótipo: role="switch" faz o leitor de tela anunciar
                    "ligado/desligado" em vez de só "botão". */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span id={`rotulo-ativo-${servico.id}`} className="text-slate-800">
                    Serviço ativo
                  </span>
                  <button type="button" role="switch" aria-checked={ativo}
                    aria-labelledby={`rotulo-ativo-${servico.id}`}
                    disabled={alternando === servico.id}
                    onClick={() => alternarAtivo(servico)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festa-600/40 disabled:opacity-50 ${
                      ativo ? 'bg-festa-600' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
