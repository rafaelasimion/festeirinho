'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Campo from '@/componentes/campo';
import {
  UFS, validarEmail, validarTelefone, validarNomeUsuario,
} from '@/lib/validacao';

// UC 004 — edição dos dados da CONTA. Os dados que o fornecedor exibe na
// vitrine ficam em "Meu perfil": só aqueles disparam nova verificação
// (RN067), e misturar os dois num formulário só faria o fornecedor perder
// o selo ao corrigir o próprio telefone.

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

export default function FormularioConta({ dados, documento, ehFornecedor }) {
  const router = useRouter();

  const [campos, setCampos] = useState({
    nome: dados.nome ?? '',
    nomeUsuario: dados.nome_usuario ?? '',
    email: dados.email ?? '',
    telefone: dados.telefone ?? '',
    estado: dados.estado ?? '',
    cidade: dados.cidade ?? '',
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');

  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senhas, setSenhas] = useState({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  const [errosSenha, setErrosSenha] = useState({});
  const [mensagemSenha, setMensagemSenha] = useState('');

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setMensagem('');
  }

  function aoDigitarSenha(evento) {
    const { name, value } = evento.target;
    setSenhas((anterior) => ({ ...anterior, [name]: value }));
    setErrosSenha((anterior) => ({ ...anterior, [name]: undefined }));
  }

  async function salvar() {
    setErros({});
    setErroGeral('');
    setMensagem('');
    setSalvando(true);

    try {
      const resposta = await fetch('/api/perfil/conta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      const retorno = await resposta.json();

      if (resposta.ok) {
        setMensagem('Dados atualizados.');
        router.refresh();
        return;
      }
      if (retorno.erros) setErros(retorno.erros);
      else setErroGeral(retorno.erro ?? 'Não foi possível salvar.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    setErrosSenha({});
    setMensagemSenha('');

    if (senhas.novaSenha !== senhas.confirmacao) {
      setErrosSenha({ confirmacao: 'As senhas não coincidem.' });
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch('/api/perfil/conta', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual: senhas.senhaAtual,
          novaSenha: senhas.novaSenha,
        }),
      });
      const retorno = await resposta.json();

      if (resposta.ok) {
        setTrocandoSenha(false);
        setSenhas({ senhaAtual: '', novaSenha: '', confirmacao: '' });
        setMensagem('Senha alterada.');
        return;
      }
      if (retorno.erros) setErrosSenha(retorno.erros);
      else setMensagemSenha(retorno.erro ?? 'Não foi possível alterar a senha.');
    } catch {
      setMensagemSenha('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/minha-conta"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para minha conta
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Dados da conta</h1>

      {ehFornecedor && (
        <p className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Aqui ficam os dados da sua conta. Nome de exibição, descrição e redes sociais —
          o que o cliente vê na vitrine — ficam em{' '}
          <Link href="/fornecedor/perfil" className="font-medium text-festa-700 hover:underline">
            Meu perfil
          </Link>, porque alterá-los envia o perfil para nova verificação.
        </p>
      )}

      <div className="space-y-4">
        <Campo label="Nome completo" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome}
          validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome completo.'} />

        <Campo label="Nome de usuário" name="nomeUsuario" value={campos.nomeUsuario}
          onChange={aoDigitar} erro={erros.nomeUsuario}
          validar={(v) => validarNomeUsuario(v)
            ? null
            : 'Use de 3 a 50 caracteres: letras, números, ponto ou _.'} />

        <Campo label="E-mail" name="email" type="email" value={campos.email}
          onChange={aoDigitar} erro={erros.email}
          dica="É com ele que você entra na plataforma."
          validar={(v) => validarEmail(v) ? null : 'Informe um e-mail válido.'} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone}
          validar={(v) => validarTelefone(v) ? null : 'Informe o telefone com DDD.'} />

        <div>
          <label htmlFor="estado" className="mb-1.5 block text-sm font-medium text-slate-700">
            Estado
          </label>
          <select id="estado" name="estado" value={campos.estado}
            onChange={aoDigitar} className={CLASSE_SELECT}>
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {erros.estado && <p className="mt-1 text-sm text-red-600">{erros.estado}</p>}
        </div>

        <Campo label="Cidade" name="cidade" value={campos.cidade}
          onChange={aoDigitar} erro={erros.cidade}
          validar={(v) => v.trim().length >= 2 ? null : 'Informe a cidade.'} />

        {/* RN001 — o documento identifica a pessoa verificada pela
            plataforma e não é editável por aqui. */}
        {documento && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-medium">
              {documento.tipo_pessoa === 'PJ' ? 'CNPJ: ' : 'CPF: '}
            </span>
            {documento.tipo_pessoa === 'PJ' ? documento.cnpj : documento.cpf}
            <p className="mt-1 text-xs text-slate-500">
              {ehFornecedor
                ? 'Para corrigir o documento, use Meu perfil enquanto a verificação não estiver aprovada.'
                : 'O documento não pode ser alterado.'}
            </p>
          </div>
        )}

        {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <button type="button" onClick={salvar} disabled={salvando}
          className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <KeyRound className="h-5 w-5 text-festa-600" aria-hidden="true" />
          Senha
        </h2>

        {trocandoSenha ? (
          <div className="mt-4 space-y-4">
            <Campo label="Senha atual" name="senhaAtual" type="password"
              value={senhas.senhaAtual} onChange={aoDigitarSenha} erro={errosSenha.senhaAtual} />

            <Campo label="Nova senha" name="novaSenha" type="password"
              value={senhas.novaSenha} onChange={aoDigitarSenha} erro={errosSenha.novaSenha}
              dica="Mínimo de 8 caracteres."
              validar={(v) => v.length >= 8 ? null : 'A senha deve ter ao menos 8 caracteres.'} />

            <Campo label="Confirmar nova senha" name="confirmacao" type="password"
              value={senhas.confirmacao} onChange={aoDigitarSenha} erro={errosSenha.confirmacao}
              validar={(v) => v === senhas.novaSenha ? null : 'As senhas não coincidem.'} />

            {mensagemSenha && <p className="text-sm text-red-600">{mensagemSenha}</p>}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={trocarSenha} disabled={salvando}
                className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                Alterar senha
              </button>
              <button type="button" onClick={() => setTrocandoSenha(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Para trocar a senha é preciso informar a atual.
            </p>
            <button type="button" onClick={() => setTrocandoSenha(true)}
              className="rounded-lg border border-festa-600 px-4 py-2 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
              Trocar senha
            </button>
          </div>
        )}
      </section>

      {/* UC 007 — a exclusão fica no fim da tela, separada, e não repete o
          aviso: a tela própria explica o que acontece. */}
      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="font-medium text-slate-900">Excluir conta</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Remove seus dados pessoais em caráter definitivo.
          </p>
          <Link href="/minha-conta/excluir"
            className="rounded-lg border border-perigo-600 px-4 py-2 text-sm font-medium text-perigo-700 transition-colors hover:bg-perigo-50">
            Excluir minha conta
          </Link>
        </div>
      </section>
    </main>
  );
}
