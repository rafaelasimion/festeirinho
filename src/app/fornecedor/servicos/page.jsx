'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Campo from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import {
  formatarPreco,
  ROTULO_COBRANCA,
  SUFIXO_PRECO,
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
        if (respostaOpcoes.ok) setOpcoes(await respostaOpcoes.json());
        await carregarServicos();
      } catch {
        setErroGeral('Falha de conexão.');
      }
    }
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setEditando(null);
        setMensagem(
          ehNovo
            ? 'Serviço cadastrado. Ele aparece para os clientes após a verificação.'
            : dados.voltouParaVerificacao
              ? 'Serviço salvo. Como você mudou nome, descrição, categoria ou preço, ele saiu da vitrine até a nova aprovação.'
              : 'Serviço salvo.'
        );
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

  async function alterarStatus(servico) {
    const acao = servico.status_servico === 'ativo' ? 'inativar' : 'reativar';
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
      setMensagem(acao === 'inativar' ? 'Serviço inativado.' : 'Serviço reativado.');
      await carregarServicos();
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    }
  }

  if (servicos === null) {
    return <main className="mx-auto max-w-2xl p-6"><p className="text-sm">Carregando...</p></main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meus serviços</h1>
        {editando === null && (
          <button type="button" onClick={abrirNovo}
            className="rounded-lg bg-festa-600 hover:bg-festa-700 px-3 py-1.5 text-sm text-white">
            Novo serviço
          </button>
        )}
      </div>

      {mensagem && <p className="mb-4 text-sm text-green-700">{mensagem}</p>}
      {erroGeral && <p className="mb-4 text-sm text-red-600">{erroGeral}</p>}

      {editando !== null && (
        <div className="mb-8 space-y-4 rounded-lg border border-gray-300 p-4">
          <h2 className="font-medium">
            {editando === 'novo' ? 'Novo serviço' : 'Editar serviço'}
          </h2>

          <Campo label="Nome do serviço" name="nome" value={campos.nome}
            onChange={aoDigitar} erro={erros.nome} />

          <div>
            <label htmlFor="descricao" className="mb-1 block text-sm font-medium">Descrição</label>
            <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
              onChange={aoDigitar}
              className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
          </div>

          <div>
            <label htmlFor="idCategoria" className="mb-1 block text-sm font-medium">Categoria</label>
            <select id="idCategoria" name="idCategoria" value={campos.idCategoria}
              onChange={aoDigitar} className="w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Selecione</option>
              {opcoes?.categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
              ))}
            </select>
            {erros.idCategoria && <p className="mt-1 text-sm text-red-600">{erros.idCategoria}</p>}
          </div>

          <div>
            <label htmlFor="idCobranca" className="mb-1 block text-sm font-medium">
              Forma de cobrança
            </label>
            <select id="idCobranca" name="idCobranca" value={campos.idCobranca}
              onChange={aoDigitar} className="w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Selecione</option>
              {opcoes?.cobrancas.map((cobranca) => (
                <option key={cobranca.id} value={cobranca.id}>
                  {ROTULO_COBRANCA[cobranca.descricao]}
                </option>
              ))}
            </select>
            {erros.idCobranca && <p className="mt-1 text-sm text-red-600">{erros.idCobranca}</p>}
          </div>

          <Campo label="Preço base (R$)" name="precoBase" type="number" step="0.01" min="0.01"
            value={campos.precoBase} onChange={aoDigitar} erro={erros.precoBase} />

          <Campo label="Capacidade máxima de convidados" name="capacidadeMax" type="number" min="1"
            value={campos.capacidadeMax} onChange={aoDigitar} erro={erros.capacidadeMax}
            dica="Deixe em branco se não houver limite." />

          <Campo label="Antecedência mínima (dias)" name="diasAntecedencia" type="number"
            min={opcoes?.antecedenciaMinimaDias ?? 1}
            value={campos.diasAntecedencia} onChange={aoDigitar} erro={erros.diasAntecedencia}
            dica={`Mínimo permitido pela plataforma: ${opcoes?.antecedenciaMinimaDias ?? '...'} dias.`} />

          <div className="flex gap-2">
            <button type="button" onClick={salvar} disabled={salvando}
              className="rounded-lg bg-festa-600 hover:bg-festa-700 px-4 py-2 text-sm text-white disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => setEditando(null)}
              className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {servicos.length === 0 ? (
        <p className="text-sm text-gray-600">
          Você ainda não cadastrou nenhum serviço.
        </p>
      ) : (
        <ul className="space-y-4">
          {servicos.map((servico) => (
            <li key={servico.id} className="rounded-lg border border-gray-300 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{servico.nome}</h3>
                  <p className="text-sm text-gray-600">
                    {servico.categoria} · {formatarPreco(servico.preco_base)}
                    {SUFIXO_PRECO[servico.cobranca]}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Etiqueta tom={TOM_VERIFICACAO[servico.status_verificacao]} contorno>
                      {ROTULO_VERIFICACAO[servico.status_verificacao]}
                    </Etiqueta>
                    {servico.status_servico === 'inativo' && (
                      <Etiqueta tom="neutro" contorno>inativo</Etiqueta>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    antecedência de {servico.dias_antecedencia} dias
                    {servico.capacidade_max !== null && ` · até ${servico.capacidade_max} convidados`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => abrirEdicao(servico)}
                    className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-3 py-1 text-sm">
                    Editar
                  </button>
                  <button type="button" onClick={() => alterarStatus(servico)}
                    className="rounded-lg border rounded-lg border border-festa-600 text-festa-700 hover:bg-festa-50 px-3 py-1.5 text-sm px-3 py-1 text-sm">
                    {servico.status_servico === 'ativo' ? 'Inativar' : 'Reativar'}
                  </button>
                </div>
              </div>

              {servico.motivo_rejeicao && servico.status_verificacao !== 'aprovado' && (
                <p className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-2 text-sm">
                  <span className="font-medium">Motivo da rejeição: </span>
                  {servico.motivo_rejeicao}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
