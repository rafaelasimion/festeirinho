'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS, dataMaximaNascimento, IDADE_MINIMA } from '@/lib/validacao';

const ROTULO_VERIFICACAO = {
  pendente: 'Verificação pendente',
  aprovado: 'Perfil verificado',
  rejeitado: 'Verificação rejeitada',
};

export default function PerfilFornecedor() {
  const router = useRouter();
  const [campos, setCampos] = useState(null);
  const [status, setStatus] = useState(null);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carrega o perfil assim que a tela abre.
  useEffect(() => {
    async function carregar() {
      try {
        const resposta = await fetch('/api/fornecedor/perfil');
        if (resposta.status === 401) {
          router.push('/login');
          return;
        }
        if (!resposta.ok) {
          setErroGeral('Não foi possível carregar o perfil.');
          return;
        }
        const dados = await resposta.json();
        setCampos({
          nome: dados.nome ?? '',
          telefone: dados.telefone ?? '',
          cidade: dados.cidade ?? '',
          estado: dados.estado ?? '',
          cpf: dados.cpf ?? '',
          dataNascimento: dados.data_nascimento ?? '',
          cnpj: dados.cnpj ?? '',
          razaoSocial: dados.razao_social ?? '',
          nomeExibicao: dados.nome_exibicao ?? '',
          descricao: dados.descricao ?? '',
          instagramUrl: dados.instagram_url ?? '',
          whatsappUrl: dados.whatsapp_url ?? '',
          site: dados.site ?? '',
          raioAtendimentoKm: String(dados.raio_atendimento_km ?? 30),
        });
        setStatus({
          tipoPessoa: dados.tipo_pessoa,
          verificacao: dados.status_verificacao,
          fornecedor: dados.status_fornecedor,
          motivoRejeicao: dados.motivo_rejeicao,
        });
      } catch {
        setErroGeral('Falha de conexão ao carregar o perfil.');
      }
    }
    carregar();
  }, [router]);

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setMensagem('');
  }

  async function salvar() {
    setErros({});
    setErroGeral('');
    setMensagem('');
    setSalvando(true);

    try {
      const resposta = await fetch('/api/fornecedor/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campos,
          raioAtendimentoKm: Number(campos.raioAtendimentoKm),
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setStatus((anterior) => ({ ...anterior, verificacao: dados.statusVerificacao }));
        setMensagem(
          dados.voltouParaVerificacao
            ? 'Alterações salvas. Como você mudou dados da vitrine, seu perfil voltou para verificação.'
            : 'Alterações salvas.'
        );
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

  async function alterarDisponibilidade(acao) {
    setErroGeral('');
    try {
      const resposta = await fetch('/api/fornecedor/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível alterar o status.');
        return;
      }
      setStatus((anterior) => ({ ...anterior, fornecedor: dados.statusFornecedor }));
      setMensagem(
        dados.statusFornecedor === 'pausado'
          ? 'Seu perfil está pausado e não aparece para novos clientes.'
          : 'Seu perfil voltou a aparecer para os clientes.'
      );
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    }
  }

  if (erroGeral && !campos) {
    return <main className="mx-auto max-w-xl p-6"><p className="text-sm text-red-600">{erroGeral}</p></main>;
  }

  if (!campos) {
    return <main className="mx-auto max-w-xl p-6"><p className="text-sm">Carregando...</p></main>;
  }

  const ehPF = status.tipoPessoa === 'PF';
  const documentoEditavel = status.verificacao !== 'aprovado';
  const avisoImutavel = 'Imutável após a aprovação da verificação.';

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Meu perfil</h1>
      <p className="mb-6 text-sm text-gray-600">
        {ROTULO_VERIFICACAO[status.verificacao]}
        {status.fornecedor === 'pausado' && ' · Perfil pausado'}
      </p>

      {status.motivoRejeicao && status.verificacao !== 'aprovado' && (
        <div className="mb-6 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
          <span className="font-medium">Motivo da última rejeição: </span>
          {status.motivoRejeicao}
        </div>
      )}

      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Dados do responsável</p>

        <Campo label="Nome" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone} />

        <p className="pt-2 text-sm font-medium text-gray-700">Dados do negócio</p>

        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <span className="font-medium">Tipo de pessoa: </span>
          {ehPF ? 'Pessoa física' : 'Pessoa jurídica'}
          <p className="mt-1 text-xs text-gray-500">Não pode ser alterado.</p>
        </div>

        {ehPF ? (
          <>
            <Campo label="CPF" name="cpf" value={campos.cpf} onChange={aoDigitar}
              erro={erros.cpf} disabled={!documentoEditavel}
              dica={documentoEditavel ? null : avisoImutavel} />
            <Campo label="Data de nascimento" name="dataNascimento" type="date"
              max={dataMaximaNascimento()}
              value={campos.dataNascimento} onChange={aoDigitar}
              erro={erros.dataNascimento} disabled={!documentoEditavel}
              dica={documentoEditavel
                ? `É necessário ter ao menos ${IDADE_MINIMA} anos completos.`
                : avisoImutavel} />
          </>
        ) : (
          <>
            <Campo label="CNPJ" name="cnpj" value={campos.cnpj} onChange={aoDigitar}
              erro={erros.cnpj} disabled={!documentoEditavel}
              dica={documentoEditavel ? null : avisoImutavel} />
            <Campo label="Razão social" name="razaoSocial" value={campos.razaoSocial}
              onChange={aoDigitar} erro={erros.razaoSocial} />
          </>
        )}

        <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
          onChange={aoDigitar} erro={erros.nomeExibicao} />

        <div>
          <label htmlFor="descricao" className="mb-1 block text-sm font-medium">Descrição</label>
          <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
            onChange={aoDigitar}
            className="w-full rounded border border-gray-300 px-3 py-2" />
          {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
        </div>

        <Campo label="Instagram" name="instagramUrl" value={campos.instagramUrl}
          onChange={aoDigitar} erro={erros.instagramUrl} placeholder="https://..." />

        <Campo label="WhatsApp" name="whatsappUrl" value={campos.whatsappUrl}
          onChange={aoDigitar} erro={erros.whatsappUrl} placeholder="https://..." />

        <Campo label="Site" name="site" value={campos.site}
          onChange={aoDigitar} erro={erros.site} placeholder="https://..." />

        <p className="text-xs text-gray-500">
          Alterar nome de exibição, descrição, razão social ou redes sociais envia seu
          perfil para nova verificação.
        </p>

        <p className="pt-2 text-sm font-medium text-gray-700">Área de atendimento</p>

        <div>
          <label htmlFor="estado" className="mb-1 block text-sm font-medium">Estado</label>
          <select id="estado" name="estado" value={campos.estado} onChange={aoDigitar}
            className="w-full rounded border border-gray-300 px-3 py-2">
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {erros.estado && <p className="mt-1 text-sm text-red-600">{erros.estado}</p>}
        </div>

        <Campo label="Cidade" name="cidade" value={campos.cidade}
          onChange={aoDigitar} erro={erros.cidade} />

        <Campo label="Raio de atendimento (km)" name="raioAtendimentoKm" type="number"
          min="1" max="200" value={campos.raioAtendimentoKm}
          onChange={aoDigitar} erro={erros.raioAtendimentoKm} />

        {mensagem && <p className="text-sm text-green-700">{mensagem}</p>}
        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <button type="button" onClick={salvar} disabled={salvando}
          className="w-full rounded bg-gray-900 px-4 py-2.5 text-white disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <p className="text-sm font-medium text-gray-700">Disponibilidade</p>
          <p className="mt-1 text-sm text-gray-600">
            Pausar esconde seu perfil de novos clientes. Seus dados, serviços e
            histórico continuam guardados.
          </p>
          <button type="button"
            onClick={() => alterarDisponibilidade(status.fornecedor === 'pausado' ? 'reativar' : 'pausar')}
            className="mt-3 rounded border border-gray-400 px-3 py-1.5 text-sm">
            {status.fornecedor === 'pausado' ? 'Reativar meu perfil' : 'Pausar meu perfil'}
          </button>
        </div>
      </div>
    </main>
  );
}

function Campo({ label, name, erro, dica, ...resto }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} {...resto}
        className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
      {dica && <p className="mt-1 text-xs text-gray-500">{dica}</p>}
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}