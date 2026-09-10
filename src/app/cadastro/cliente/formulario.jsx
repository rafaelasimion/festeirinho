'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS, dataMaximaNascimento, IDADE_MINIMA } from '@/lib/validacao';

const CAMPOS_INICIAIS = {
  nome: '',
  nomeUsuario: '',
  email: '',
  telefone: '',
  senha: '',
  confirmacaoSenha: '',
  estado: '',
  cidade: '',
  cpf: '',
  dataNascimento: '',
};

export default function FormularioCadastroCliente() {
  const router = useRouter();
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [coordenadas, setCoordenadas] = useState(null);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [avisoCpf, setAvisoCpf] = useState('');
  const [enviando, setEnviando] = useState(false);

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
      const resposta = await fetch('/api/cadastro/cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campos,
          latitude: coordenadas?.latitude ?? null,
          longitude: coordenadas?.longitude ?? null,
          cienteCpfOutroPapel,
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        router.push('/login?cadastro=ok');
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
      <h1 className="mb-6 text-2xl font-semibold">Criar conta de cliente</h1>

      <div className="space-y-4">
        <Campo label="Nome completo" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome} />

        <Campo label="Nome de usuário" name="nomeUsuario" value={campos.nomeUsuario}
          onChange={aoDigitar} erro={erros.nomeUsuario} />

        <Campo label="E-mail" name="email" type="email" value={campos.email}
          onChange={aoDigitar} erro={erros.email} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone} placeholder="16999998888" />

        <Campo label="CPF" name="cpf" value={campos.cpf}
          onChange={aoDigitar} erro={erros.cpf} placeholder="Somente números" />

        <Campo label="Data de nascimento" name="dataNascimento" type="date"
          max={dataMaximaNascimento()}
          value={campos.dataNascimento} onChange={aoDigitar} erro={erros.dataNascimento}
          dica={`É necessário ter ao menos ${IDADE_MINIMA} anos completos.`} />

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

        <Campo label="Senha" name="senha" type="password" value={campos.senha}
          onChange={aoDigitar} erro={erros.senha}
          dica="Mínimo de 8 caracteres." />

        <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
          value={campos.confirmacaoSenha} onChange={aoDigitar} erro={erros.confirmacaoSenha} />

        <div className="rounded border border-gray-200 p-3">
          <p className="text-sm">
            Informar sua localização ajuda a mostrar fornecedores perto de você. É opcional.
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

        <button type="button" onClick={() => enviar(false)} disabled={enviando || Boolean(avisoCpf)}
          className="w-full rounded bg-gray-900 px-4 py-2.5 text-white disabled:opacity-50">
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </main>
  );
}

function Campo({ label, name, erro, dica, ...resto }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={name} name={name} {...resto}
        className="w-full rounded border border-gray-300 px-3 py-2" />
      {dica && <p className="mt-1 text-xs text-gray-500">{dica}</p>}
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}