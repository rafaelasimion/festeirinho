'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UFS, dataMaximaNascimento, IDADE_MINIMA,
  validarCPF, validarEmail, validarTelefone, validarNomeUsuario, validarMaioridade,
} from '@/lib/validacao';
import Campo from '@/componentes/campo';
import CapturaLocalizacao from '@/componentes/captura-localizacao';

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

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

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
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Criar conta de cliente</h1>

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
          validar={(v) => validarEmail(v) ? null : 'Informe um e-mail válido.'} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone} placeholder="16999998888"
          validar={(v) => validarTelefone(v) ? null : 'Informe o telefone com DDD.'} />

        <Campo label="CPF" name="cpf" value={campos.cpf}
          onChange={aoDigitar} erro={erros.cpf} placeholder="Somente números"
          validar={(v) => validarCPF(v) ? null : 'CPF inválido.'} />

        <Campo label="Data de nascimento" name="dataNascimento" type="date"
          max={dataMaximaNascimento()}
          value={campos.dataNascimento} onChange={aoDigitar} erro={erros.dataNascimento}
          dica={`É necessário ter ao menos ${IDADE_MINIMA} anos completos.`}
          validar={(v) => validarMaioridade(v)
            ? null
            : `É necessário ter ao menos ${IDADE_MINIMA} anos completos.`} />

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

        <Campo label="Senha" name="senha" type="password" value={campos.senha}
          onChange={aoDigitar} erro={erros.senha}
          dica="Mínimo de 8 caracteres."
          validar={(v) => v.length >= 8 ? null : 'A senha deve ter ao menos 8 caracteres.'} />

        <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
          value={campos.confirmacaoSenha} onChange={aoDigitar} erro={erros.confirmacaoSenha}
          validar={(v) => v === campos.senha ? null : 'As senhas não coincidem.'} />

        <CapturaLocalizacao
          coordenadas={coordenadas}
          aoAlterar={setCoordenadas}
          descricao="Ajuda a mostrar fornecedores que atendem a sua região." />

        {avisoCpf && (
          <div className="rounded-lg border border-atencao-600 bg-atencao-50 p-3">
            <p className="text-sm text-slate-700">{avisoCpf}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => enviar(true)} disabled={enviando}
                className="rounded-lg bg-festa-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
                Continuar mesmo assim
              </button>
              <button type="button" onClick={() => setAvisoCpf('')}
                className="rounded-lg border border-festa-600 px-3 py-1.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
                Revisar o CPF
              </button>
            </div>
          </div>
        )}

        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <button type="button" onClick={() => enviar(false)}
          disabled={enviando || Boolean(avisoCpf)}
          className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </main>
  );
}