'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  UFS, dataMaximaNascimento, IDADE_MINIMA,
  validarCPF, validarEmail, validarTelefone, validarNomeUsuario, validarMaioridade,
} from '@/lib/validacao';
import Campo, { CampoSelecao } from '@/componentes/campo';
import SecaoFormulario from '@/componentes/secao-formulario';
import MolduraAuth from '@/componentes/moldura-auth';
import CapturaLocalizacao from '@/componentes/captura-localizacao';
import AvisoCpfOutroPapel from '@/componentes/aviso-cpf-outro-papel';

// UC 001 / RF001 — cadastro de cliente.
//
// Os campos estão na mesma ordem em que alguém os pensa: primeiro quem é,
// depois onde está, e só no fim como vai entrar. A senha por último é o
// hábito de qualquer cadastro, e evita que ela seja digitada antes de a
// pessoa decidir que vai até o fim.

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
    <MolduraAuth largura="max-w-xl">
      <Link href="/cadastro"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Trocar tipo de conta
      </Link>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Criar conta de cliente
        </h1>
        <p className="mt-1.5 text-slate-600">
          Depois disso você já pode pedir orçamentos e contratar.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {/* RF001 — CPF e data de nascimento não são burocracia: é por eles
            que o sistema confere a capacidade civil exigida para contratar
            e pagar. A descrição da seção diz isso em uma linha, para o
            pedido não parecer gratuito. */}
        <SecaoFormulario numero={1} titulo="Seus dados"
          descricao="Exigidos para contratar e pagar pela plataforma.">
          <Campo label="Nome completo" name="nome" value={campos.nome}
            autoComplete="name"
            onChange={aoDigitar} erro={erros.nome}
            validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome completo.'} />

          {/* CPF e nascimento andam juntos: os dois identificam a mesma
              pessoa e os dois são curtos, então dividem a linha no
              desktop e empilham no celular. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="CPF" name="cpf" value={campos.cpf}
              inputMode="numeric"
              onChange={aoDigitar} erro={erros.cpf} placeholder="Somente números"
              validar={(v) => validarCPF(v) ? null : 'CPF inválido.'} />

            <Campo label="Data de nascimento" name="dataNascimento" type="date"
              max={dataMaximaNascimento()}
              value={campos.dataNascimento} onChange={aoDigitar}
              erro={erros.dataNascimento}
              dica={`Mínimo de ${IDADE_MINIMA} anos completos.`}
              validar={(v) => validarMaioridade(v)
                ? null
                : `É necessário ter ao menos ${IDADE_MINIMA} anos completos.`} />
          </div>

          <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
            inputMode="tel" autoComplete="tel"
            onChange={aoDigitar} erro={erros.telefone} placeholder="16999998888"
            validar={(v) => validarTelefone(v) ? null : 'Informe o telefone com DDD.'} />
        </SecaoFormulario>

        <SecaoFormulario numero={2} titulo="Onde você está"
          descricao="Usado para mostrar quem atende a sua região.">
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoSelecao label="Estado" name="estado" value={campos.estado}
              onChange={aoDigitar} erro={erros.estado}>
              <option value="">Selecione</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </CampoSelecao>

            <Campo label="Cidade" name="cidade" value={campos.cidade}
              autoComplete="address-level2"
              onChange={aoDigitar} erro={erros.cidade}
              validar={(v) => v.trim().length >= 2 ? null : 'Informe a cidade.'} />
          </div>

          <CapturaLocalizacao
            coordenadas={coordenadas}
            aoAlterar={setCoordenadas}
            descricao="Ajuda a mostrar fornecedores que atendem a sua região." />
        </SecaoFormulario>

        <SecaoFormulario numero={3} titulo="Acesso à conta"
          descricao="Com o que você vai entrar daqui em diante.">
          <Campo label="Nome de usuário" name="nomeUsuario" value={campos.nomeUsuario}
            autoComplete="username"
            onChange={aoDigitar} erro={erros.nomeUsuario}
            validar={(v) => validarNomeUsuario(v)
              ? null
              : 'Use de 3 a 50 caracteres: letras, números, ponto ou _.'} />

          <Campo label="E-mail" name="email" type="email" value={campos.email}
            autoComplete="email"
            onChange={aoDigitar} erro={erros.email}
            validar={(v) => validarEmail(v) ? null : 'Informe um e-mail válido.'} />

          <Campo label="Senha" name="senha" type="password" value={campos.senha}
            autoComplete="new-password"
            onChange={aoDigitar} erro={erros.senha}
            dica="Mínimo de 8 caracteres."
            validar={(v) => v.length >= 8 ? null : 'A senha deve ter ao menos 8 caracteres.'} />

          <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
            autoComplete="new-password"
            value={campos.confirmacaoSenha} onChange={aoDigitar}
            erro={erros.confirmacaoSenha}
            validar={(v) => v === campos.senha ? null : 'As senhas não coincidem.'} />
        </SecaoFormulario>

        {avisoCpf && (
          <AvisoCpfOutroPapel aviso={avisoCpf} enviando={enviando}
            aoContinuar={() => enviar(true)}
            aoRevisar={() => setAvisoCpf('')} />
        )}

        {erroGeral && (
          <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erroGeral}
          </p>
        )}

        <button type="button" onClick={() => enviar(false)}
          disabled={enviando || Boolean(avisoCpf)}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-festa-700 hover:underline">
          Entrar
        </Link>
      </p>
    </MolduraAuth>
  );
}
