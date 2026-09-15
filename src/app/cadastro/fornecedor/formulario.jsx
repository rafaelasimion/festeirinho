'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Building2, Check } from 'lucide-react';
import {
  UFS, dataMaximaNascimento, IDADE_MINIMA,
  validarCPF, validarCNPJ, validarEmail, validarTelefone,
  validarNomeUsuario, validarMaioridade, validarURL,
} from '@/lib/validacao';
import Campo from '@/componentes/campo';
import CapturaLocalizacao from '@/componentes/captura-localizacao';

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

const CLASSE_TEXTAREA =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

const TIPOS_PESSOA = [
  { valor: 'PF', rotulo: 'Pessoa física', detalhe: 'Atuo com meu CPF', Icone: User },
  { valor: 'PJ', rotulo: 'Pessoa jurídica', detalhe: 'Tenho empresa aberta', Icone: Building2 },
];

// raioPadrao chega da página de servidor, que o leu da tabela configuracao
// (RN068). O formulário não decide esse número.
export default function FormularioCadastroFornecedor({ raioPadrao }) {
  const router = useRouter();

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
    dataNascimento: '',
    cnpj: '',
    razaoSocial: '',
    nomeExibicao: '',
    descricao: '',
    instagramUrl: '',
    whatsappUrl: '',
    site: '',
    raioAtendimentoKm: String(raioPadrao),
  };

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
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Criar conta de fornecedor</h1>

      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">Dados de acesso</p>

        <Campo label="Nome do responsável" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome}
          validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome do responsável.'} />

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

        <Campo label="Senha" name="senha" type="password" value={campos.senha}
          onChange={aoDigitar} erro={erros.senha} dica="Mínimo de 8 caracteres."
          validar={(v) => v.length >= 8 ? null : 'A senha deve ter ao menos 8 caracteres.'} />

        <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
          value={campos.confirmacaoSenha} onChange={aoDigitar} erro={erros.confirmacaoSenha}
          validar={(v) => v === campos.senha ? null : 'As senhas não coincidem.'} />

        <p className="pt-2 text-sm font-medium text-slate-700">Dados do negócio</p>

        {/* Radio de verdade, escondido visualmente: mantém navegação por
            setas do teclado e leitura correta por leitor de tela. */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">
            Tipo de pessoa
          </legend>

          <div className="grid grid-cols-2 gap-3">
            {TIPOS_PESSOA.map(({ valor, rotulo, detalhe, Icone }) => {
              const selecionado = campos.tipoPessoa === valor;
              return (
                <label key={valor}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4
                    transition-colors focus-within:ring-2 focus-within:ring-festa-600/40
                    ${selecionado
                      ? 'border-festa-600 bg-festa-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input type="radio" name="tipoPessoa" value={valor}
                    checked={selecionado} onChange={aoDigitar} className="sr-only" />

                  <Icone aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      selecionado ? 'text-festa-600' : 'text-slate-400'}`} />

                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${
                      selecionado ? 'text-festa-800' : 'text-slate-800'}`}>
                      {rotulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{detalhe}</span>
                  </span>

                  {selecionado && (
                    <span aria-hidden="true"
                      className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-festa-600">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Não é possível alterar depois do cadastro.
          </p>
          {erros.tipoPessoa && <p className="mt-1 text-sm text-red-600">{erros.tipoPessoa}</p>}
        </fieldset>

        {ehPF ? (
          <>
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
          </>
        ) : (
          <>
            <Campo label="CNPJ" name="cnpj" value={campos.cnpj}
              onChange={aoDigitar} erro={erros.cnpj}
              placeholder="Números ou letras, sem pontuação"
              validar={(v) => validarCNPJ(v) ? null : 'CNPJ inválido.'} />
            <Campo label="Razão social" name="razaoSocial" value={campos.razaoSocial}
              onChange={aoDigitar} erro={erros.razaoSocial}
              validar={(v) => v.trim().length >= 2 ? null : 'Informe a razão social.'} />
          </>
        )}

        <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
          onChange={aoDigitar} erro={erros.nomeExibicao}
          placeholder="Como você aparece para os clientes"
          validar={(v) => v.trim().length >= 2
            ? null
            : 'Informe o nome que aparecerá na vitrine.'} />

        <div>
          <label htmlFor="descricao" className="mb-1.5 block text-sm font-medium text-slate-700">
            Descrição do seu trabalho
          </label>
          <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
            onChange={aoDigitar} className={CLASSE_TEXTAREA} />
          <p className="mt-1 text-xs text-slate-500">
            {campos.descricao.trim().length}/20 caracteres mínimos.
          </p>
          {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
        </div>

        <Campo label="Instagram (opcional)" name="instagramUrl" value={campos.instagramUrl}
          onChange={aoDigitar} erro={erros.instagramUrl} placeholder="https://..."
          validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />

        <Campo label="WhatsApp (opcional)" name="whatsappUrl" value={campos.whatsappUrl}
          onChange={aoDigitar} erro={erros.whatsappUrl} placeholder="https://..."
          validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />

        <Campo label="Site (opcional)" name="site" value={campos.site}
          onChange={aoDigitar} erro={erros.site} placeholder="https://..."
          validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />

        <p className="pt-2 text-sm font-medium text-slate-700">Área de atendimento</p>

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

        <Campo label="Raio de atendimento (km)" name="raioAtendimentoKm" type="number"
          min="1" max="200" value={campos.raioAtendimentoKm}
          onChange={aoDigitar} erro={erros.raioAtendimentoKm}
          dica={`Sugestão da plataforma: ${raioPadrao} km. Você pode ajustar.`}
          validar={(v) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 1 && n <= 200
              ? null
              : 'Informe um raio entre 1 e 200 km.';
          }} />

        <CapturaLocalizacao
          coordenadas={coordenadas}
          aoAlterar={setCoordenadas}
          descricao="Ajuda os clientes da sua região a encontrar você na busca." />

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

        <p className="text-sm text-slate-600">
          Seu cadastro passa por uma verificação antes de aparecer para os clientes.
        </p>

        <button type="button" onClick={() => enviar(false)}
          disabled={enviando || Boolean(avisoCpf)}
          className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {enviando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </div>
    </main>
  );
}