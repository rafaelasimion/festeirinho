'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS } from '@/lib/validacao';

const CAMPOS_INICIAIS = {
  nome: '',
  nomeUsuario: '',
  email: '',
  telefone: '',
  senha: '',
  confirmacaoSenha: '',
  estado: '',
  cidade: '',
  tipoPessoa: 'PF',
  cpf: '',
  cnpj: '',
  razaoSocial: '',
  nomeExibicao: '',
  descricao: '',
  instagramUrl: '',
  whatsappUrl: '',
  site: '',
  raioAtendimentoKm: '30',
};

export default function FormularioCadastroFornecedor() {
  const router = useRouter();
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [coordenadas, setCoordenadas] = useState(null);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [avisoCpf, setAvisoCpf] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ehPF = campos.tipoPessoa === 'PF';

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
  }

  function capturarLocalizacao() {
    if (!navigator.geolocation) {
      setErroGeral('Seu navegador não permite capturar a localização.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setCoordenadas({
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
        });
        setErroGeral('');
      },
      () => setErroGeral('Não foi possível obter a localização. Você pode cadastrar sem ela.')
    );
  }

  async function enviar(cienteCpfOutroPapel = false) {
    setErroGeral('');
    setErros({});

    if (campos.senha !== campos.confirmacaoSenha) {
      setErros({ confirmacaoSenha: 'As senhas não coincidem.' });
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/cadastro/fornecedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campos,
          raioAtendimentoKm: Number(campos.raioAtendimentoKm),
          latitude: coordenadas?.latitude ?? null,
          longitude: coordenadas?.longitude ?? null,
          cienteCpfOutroPapel,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        router.push('/login?cadastro=fornecedor');
        return;
      }

      if (dados.codigo === 'CPF_EM_OUTRO_PAPEL') {
        setAvisoCpf(dados.aviso);
        return;
      }

      if (dados.erros) setErros(dados.erros);
      else setErroGeral(dados.erro ?? 'Não foi possível concluir o cadastro.');
    } catch {
      setErroGeral('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Criar conta de fornecedor</h1>

      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Dados de acesso</p>

        <Campo label="Nome do responsável" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome} />

        <Campo label="Nome de usuário" name="nomeUsuario" value={campos.nomeUsuario}
          onChange={aoDigitar} erro={erros.nomeUsuario} />

        <Campo label="E-mail" name="email" type="email" value={campos.email}
          onChange={aoDigitar} erro={erros.email} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone} placeholder="16999998888" />

        <Campo label="Senha" name="senha" type="password" value={campos.senha}
          onChange={aoDigitar} erro={erros.senha} />

        <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
          value={campos.confirmacaoSenha} onChange={aoDigitar} erro={erros.confirmacaoSenha} />

        <p className="pt-2 text-sm font-medium text-gray-700">Dados do negócio</p>

        <div>
          <span className="mb-1 block text-sm font-medium">Tipo de pessoa</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="tipoPessoa" value="PF"
                checked={ehPF} onChange={aoDigitar} />
              Pessoa física
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="tipoPessoa" value="PJ"
                checked={!ehPF} onChange={aoDigitar} />
              Pessoa jurídica
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Não é possível alterar depois do cadastro.
          </p>
          {erros.tipoPessoa && <p className="mt-1 text-sm text-red-600">{erros.tipoPessoa}</p>}
        </div>

        {ehPF ? (
          <Campo label="CPF" name="cpf" value={campos.cpf}
            onChange={aoDigitar} erro={erros.cpf} placeholder="Somente números" />
        ) : (
          <>
            <Campo label="CNPJ" name="cnpj" value={campos.cnpj}
              onChange={aoDigitar} erro={erros.cnpj}
              placeholder="Números ou letras, sem pontuação" />
            <Campo label="Razão social" name="razaoSocial" value={campos.razaoSocial}
              onChange={aoDigitar} erro={erros.razaoSocial} />
          </>
        )}

        <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
          onChange={aoDigitar} erro={erros.nomeExibicao}
          placeholder="Como você aparece para os clientes" />

        <div>
          <label htmlFor="descricao" className="mb-1 block text-sm font-medium">
            Descrição do seu trabalho
          </label>
          <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
            onChange={aoDigitar}
            className="w-full rounded border border-gray-300 px-3 py-2" />
          {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
        </div>

        <Campo label="Instagram (opcional)" name="instagramUrl" value={campos.instagramUrl}
          onChange={aoDigitar} erro={erros.instagramUrl} placeholder="https://..." />

        <Campo label="WhatsApp (opcional)" name="whatsappUrl" value={campos.whatsappUrl}
          onChange={aoDigitar} erro={erros.whatsappUrl} placeholder="https://..." />

        <Campo label="Site (opcional)" name="site" value={campos.site}
          onChange={aoDigitar} erro={erros.site} placeholder="https://..." />

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

        <div className="rounded border border-gray-200 p-3">
          <p className="text-sm">
            Informar a localização da sua sede ajuda os clientes da região a encontrar você.
          </p>
          <button type="button" onClick={capturarLocalizacao}
            className="mt-2 rounded border border-gray-400 px-3 py-1.5 text-sm">
            {coordenadas ? 'Localização registrada' : 'Usar minha localização'}
          </button>
        </div>

        {avisoCpf && (
          <div className="rounded border border-amber-400 bg-amber-50 p-3">
            <p className="text-sm">{avisoCpf}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => enviar(true)} disabled={enviando}
                className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
                Continuar mesmo assim
              </button>
              <button type="button" onClick={() => setAvisoCpf('')}
                className="rounded border border-gray-400 px-3 py-1.5 text-sm">
                Revisar o CPF
              </button>
            </div>
          </div>
        )}

        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <p className="text-sm text-gray-600">
          Seu cadastro passa por uma verificação antes de aparecer para os clientes.
        </p>

        <button type="button" onClick={() => enviar(false)}
          disabled={enviando || Boolean(avisoCpf)}
          className="w-full rounded bg-gray-900 px-4 py-2.5 text-white disabled:opacity-50">
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </main>
  );
}

function Campo({ label, name, erro, ...resto }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} {...resto}
        className="w-full rounded border border-gray-300 px-3 py-2" />
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}