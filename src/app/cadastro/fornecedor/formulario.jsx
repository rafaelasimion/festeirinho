'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Building2, Check, BadgeCheck } from 'lucide-react';
import {
  UFS, dataMaximaNascimento, IDADE_MINIMA,
  validarCPF, validarCNPJ, validarEmail, validarTelefone,
  validarNomeUsuario, validarMaioridade, validarURL,
} from '@/lib/validacao';
import Campo, { CampoSelecao, CampoTexto } from '@/componentes/campo';
import SecaoFormulario from '@/componentes/secao-formulario';
import MolduraAuth from '@/componentes/moldura-auth';
import CapturaLocalizacao from '@/componentes/captura-localizacao';
import AvisoCpfOutroPapel from '@/componentes/aviso-cpf-outro-papel';

// UC 002 / RF002 — cadastro de fornecedor.
//
// São dezoito campos, e a ordem importa mais aqui do que no cadastro de
// cliente: a escolha PF/PJ decide quais campos existem, então ela vem
// primeiro e os documentos aparecem logo abaixo dela, não trinta linhas
// depois. As quatro seções respondem uma pergunta cada — quem é, o que
// faz, onde atende, como entra.

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
    <MolduraAuth largura="max-w-xl">
      <Link href="/cadastro"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Trocar tipo de conta
      </Link>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Criar conta de fornecedor
        </h1>
        <p className="mt-1.5 text-slate-600">
          Depois disso você já pode cadastrar serviços e receber solicitações.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <SecaoFormulario numero={1} titulo="Quem você é"
          descricao="Os documentos que a plataforma verifica.">
          {/* Radio de verdade, escondido visualmente: mantém navegação por
              setas do teclado e leitura correta por leitor de tela. */}
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              Tipo de pessoa
            </legend>

            <div className="grid grid-cols-2 gap-3">
              {TIPOS_PESSOA.map(({ valor, rotulo, detalhe, Icone }) => {
                const selecionado = campos.tipoPessoa === valor;
                return (
                  // Tudo em coluna: o ícone numa linha própria, depois o
                  // rótulo, depois o detalhe. Lado a lado, o ícone roubava
                  // largura e "Pessoa jurídica" quebrava em duas linhas
                  // enquanto o selo de selecionado passava por cima.
                  <label key={valor}
                    className={`relative flex cursor-pointer flex-col rounded-xl border p-4
                      transition-colors focus-within:ring-2 focus-within:ring-festa-600/40
                      ${selecionado
                        ? 'border-festa-600 bg-festa-50'
                        : 'border-slate-200 bg-white hover:border-festa-200'}`}>
                    <input type="radio" name="tipoPessoa" value={valor}
                      checked={selecionado} onChange={aoDigitar} className="sr-only" />

                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      selecionado ? 'bg-white' : 'bg-slate-100'}`}>
                      <Icone aria-hidden="true"
                        className={`h-5 w-5 ${selecionado ? 'text-festa-600' : 'text-slate-400'}`} />
                    </span>

                    <span className={`mt-3 block text-sm font-medium ${
                      selecionado ? 'text-festa-800' : 'text-slate-800'}`}>
                      {rotulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{detalhe}</span>

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
            {erros.tipoPessoa && (
              <p className="mt-1 text-sm text-perigo-600">{erros.tipoPessoa}</p>
            )}
          </fieldset>

          {/* RN001 — PF preenche CPF e nascimento; PJ, CNPJ e razão social.
              Os campos trocam junto com a escolha acima, e ficam logo
              abaixo dela para que a troca seja visível. */}
          {ehPF ? (
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

          <Campo label="Nome do responsável" name="nome" value={campos.nome}
            autoComplete="name"
            onChange={aoDigitar} erro={erros.nome}
            dica="Não aparece para os clientes."
            validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome do responsável.'} />
        </SecaoFormulario>

        <SecaoFormulario numero={2} titulo="Seu negócio"
          descricao="É isto que o cliente vê na vitrine.">
          <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
            onChange={aoDigitar} erro={erros.nomeExibicao}
            placeholder="Ex.: Buffet da Ana"
            dica="É este nome que aparece na vitrine e na busca."
            validar={(v) => v.trim().length >= 2
              ? null
              : 'Informe o nome que aparecerá na vitrine.'} />

          <CampoTexto label="Descrição do seu trabalho" name="descricao" rows={4}
            value={campos.descricao} onChange={aoDigitar} erro={erros.descricao}
            minimo={20}
            placeholder="O que você faz, para que tipo de festa, o que está incluso."
            validar={(v) => v.trim().length >= 20
              ? null
              : 'Descreva seu trabalho em ao menos 20 caracteres.'} />

          <Campo label="Instagram (opcional)" name="instagramUrl" value={campos.instagramUrl}
            type="url" inputMode="url"
            onChange={aoDigitar} erro={erros.instagramUrl} placeholder="https://..."
            validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />

          <Campo label="WhatsApp (opcional)" name="whatsappUrl" value={campos.whatsappUrl}
            type="url" inputMode="url"
            onChange={aoDigitar} erro={erros.whatsappUrl} placeholder="https://..."
            validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />

          <Campo label="Site (opcional)" name="site" value={campos.site}
            type="url" inputMode="url"
            onChange={aoDigitar} erro={erros.site} placeholder="https://..."
            validar={(v) => validarURL(v) ? null : 'Endereço inválido. Comece com https://'} />
        </SecaoFormulario>

        <SecaoFormulario numero={3} titulo="Área de atendimento"
          descricao="Até onde você vai, a partir da sua sede.">
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
        </SecaoFormulario>

        <SecaoFormulario numero={4} titulo="Acesso à conta"
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

          <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
            inputMode="tel" autoComplete="tel"
            onChange={aoDigitar} erro={erros.telefone} placeholder="16999998888"
            validar={(v) => validarTelefone(v) ? null : 'Informe o telefone com DDD.'} />

          <Campo label="Senha" name="senha" type="password" value={campos.senha}
            autoComplete="new-password"
            onChange={aoDigitar} erro={erros.senha} dica="Mínimo de 8 caracteres."
            validar={(v) => v.length >= 8 ? null : 'A senha deve ter ao menos 8 caracteres.'} />

          <Campo label="Confirmar senha" name="confirmacaoSenha" type="password"
            autoComplete="new-password"
            value={campos.confirmacaoSenha} onChange={aoDigitar}
            erro={erros.confirmacaoSenha}
            validar={(v) => v === campos.senha ? null : 'As senhas não coincidem.'} />
        </SecaoFormulario>

        {/* O que passa por análise são duas coisas diferentes, e o texto
            antigo ("seu cadastro passa por uma verificação antes de
            aparecer para os clientes") misturava as duas:
              RN005  o fornecedor NÃO espera aprovação — o perfil existe
                     desde já, e a verificação apenas acende o selo;
              RN031  o serviço SIM — nasce pendente e só entra na busca
                     depois de aprovado (RF013, RF014).
            Dizer aqui que ele "já aparece na busca" também não serviria:
            a busca lista serviços (RF014), e no primeiro dia ele ainda
            não tem nenhum aprovado. */}
        <div className="rounded-xl border border-festa-100 bg-festa-50 p-4">
          <div className="flex gap-3">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-festa-600" aria-hidden="true" />
            <p className="text-sm text-slate-700">
              Seu perfil não fica esperando aprovação: ele existe desde já, e o selo
              de <strong className="font-medium">fornecedor verificado</strong> acende
              nele quando a administração conferir seus dados. O que passa por análise
              antes de aparecer na busca é cada serviço que você cadastrar.
            </p>
          </div>
        </div>

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
