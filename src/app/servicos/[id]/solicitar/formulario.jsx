'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { UFS, lerInteiro, lerDecimal } from '@/lib/validacao';
import {
  calcularValorFinal,
  formatarPreco,
  SUFIXO_PRECO,
  EXPLICACAO_COBRANCA,
} from '@/lib/solicitacao';
import Campo, { CampoSelecao, CampoTexto } from '@/componentes/campo';
import SecaoFormulario from '@/componentes/secao-formulario';
import MolduraFoto from '@/componentes/moldura-foto';

// UC 012 / RF017 — solicitação de serviço.
//
// Três seções, na ordem em que o fornecedor vai precisar das respostas:
// quando e para quantos, onde, e o que dá contexto. O total fica por
// último, fora das seções e em destaque, porque é o que a pessoa confere
// antes de apertar o botão — e, pela RN029, não muda depois.

const CAMPOS_INICIAIS = {
  dataHoraEvento: '',
  duracao: '',
  numeroConvidados: '',
  idTipoLocal: '',
  tema: '',
  nomeAniversariante: '',
  idadeAniversariante: '',
  observacoes: '',
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  complemento: '',
};

// Data mínima que o calendário aceita, conforme a antecedência do serviço.
function dataMinima(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}T00:00`;
}

export default function FormularioSolicitacao({ servico, tiposLocal }) {
  const router = useRouter();
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [enviando, setEnviando] = useState(false);

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
  }

  // RF028 — o cliente vê o total antes de enviar. Mesma conta do servidor.
  const multiplicador =
    servico.cobranca === 'fixo' ? 1
      : servico.cobranca === 'hora' ? Number(campos.duracao)
        : Number(campos.numeroConvidados);

  const valorFinal =
    multiplicador > 0
      ? calcularValorFinal({
        precoBase: servico.precoBase,
        cobranca: servico.cobranca,
        duracao: Number(campos.duracao),
        numeroConvidados: Number(campos.numeroConvidados),
      })
      : null;

  // Qual campo ainda falta para a conta fechar. Cobrança fixa não depende
  // de nenhum, então lá o total aparece desde o começo.
  const faltaParaTotal =
    servico.cobranca === 'hora' ? 'a duração'
      : servico.cobranca === 'pessoa' ? 'o número de convidados'
        : 'os dados do evento';

  // RN016/RN042 — a data precisa respeitar a antecedência mínima do serviço.
  function validarDataEvento(valor) {
    if (!valor) return 'Informe a data e a hora do evento.';
    const evento = new Date(valor);
    const minimo = new Date();
    minimo.setDate(minimo.getDate() + servico.diasAntecedencia);
    if (Number.isNaN(evento.getTime())) return 'Data inválida.';
    if (evento < minimo)
      return `Este serviço exige ao menos ${servico.diasAntecedencia} dias de antecedência.`;
    return null;
  }

  // RN017 — capacidade máxima do serviço, quando houver.
  //
  // As mensagens são as mesmas da rota, palavra por palavra: quando a tela
  // dizia uma coisa e o servidor outra, a pessoa recebia duas explicações
  // diferentes para o mesmo campo, dependendo de onde o erro foi pego.
  function validarConvidados(valor) {
    const n = lerInteiro(valor);
    if (n === null) {
      return String(valor ?? '').trim() === ''
        ? 'Informe o número de convidados.'
        : 'O número de convidados precisa ser um número inteiro.';
    }
    if (n <= 0) return 'O número de convidados precisa ser maior que zero.';
    if (servico.capacidadeMax !== null && n > servico.capacidadeMax)
      return `Este serviço atende no máximo ${servico.capacidadeMax} convidados.`;
    return null;
  }

  // A validação da duração era uma função anônima que só olhava `> 0`, e o
  // JSX tinha DOIS atributos `validar` no mesmo campo — o segundo vencia
  // calado. Uma casa decimal porque a coluna é DECIMAL(4,1): com duas, o
  // valor gravado deixaria de bater com o total mostrado aqui (RN029).
  function validarDuracao(valor) {
    const n = lerDecimal(valor, { casas: 1 });
    if (n === null) {
      return String(valor ?? '').trim() === ''
        ? 'Informe a duração em horas.'
        : 'Informe a duração com no máximo uma casa decimal (ex.: 2, 2.5, 3.5).';
    }
    if (n <= 0) return 'A duração precisa ser maior que zero.';
    if (n > 999.9) return 'Duração máxima de 999,9 horas.';
    return null;
  }

  async function enviar() {
    setErros({});
    setErroGeral('');
    setEnviando(true);

    try {
      const resposta = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, idServico: servico.id }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        router.push('/minhas-solicitacoes');
        router.refresh();
        return;
      }

      if (dados.erros) setErros(dados.erros);
      else setErroGeral(dados.erro ?? 'Não foi possível enviar a solicitação.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/servicos/${servico.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao serviço
      </Link>

      {/* Cabeçalho com miniatura, como o resumo da tela de pagamento: quem
          chega aqui da busca, com várias abas abertas, reconhece pela foto
          antes de ler o nome.

          A moldura não leva altura: o <img> dela é uma camada absoluta, e a
          faixa da foto se estica até a altura do texto ao lado. Sem isso, a
          foto em pé empurrava a linha inteira para baixo. */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex">
          <MolduraFoto foto={servico.fotoPrincipal} alt=""
            className="w-24 shrink-0 sm:w-32" />

          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-festa-700">
              Solicitar serviço
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              {servico.nome}
            </h1>
            <p className="mt-0.5 truncate text-sm text-slate-600">{servico.fornecedor}</p>
            <p className="mt-2 font-semibold text-festa-800">
              {formatarPreco(servico.precoBase)}
              <span className="text-sm font-normal text-slate-600">
                {SUFIXO_PRECO[servico.cobranca]}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <SecaoFormulario numero={1} titulo="Sobre o evento"
          descricao="Quando é, quanto dura e para quantas pessoas.">
          <Campo label="Data e hora do evento" name="dataHoraEvento" type="datetime-local"
            min={dataMinima(servico.diasAntecedencia)}
            value={campos.dataHoraEvento} onChange={aoDigitar} erro={erros.dataHoraEvento}
            dica={`Este serviço exige ao menos ${servico.diasAntecedencia} dias de antecedência.`}
            validar={validarDataEvento} />

          <Campo label="Duração (horas)" name="duracao" type="number" step="0.5" min="0.5"
            value={campos.duracao} onChange={aoDigitar} erro={erros.duracao}
            dica="Horas, com no máximo uma casa decimal — ex.: 2, 2.5, 3."
            validar={validarDuracao} />

          <Campo label="Número de convidados" name="numeroConvidados" type="number" min="1"
            value={campos.numeroConvidados} onChange={aoDigitar} erro={erros.numeroConvidados}
            dica={servico.capacidadeMax !== null
              ? `Capacidade máxima deste serviço: ${servico.capacidadeMax} convidados.`
              : null}
            validar={validarConvidados} />

          <CampoSelecao label="Tipo de local" name="idTipoLocal" value={campos.idTipoLocal}
            onChange={aoDigitar} erro={erros.idTipoLocal}>
            <option value="">Selecione</option>
            {tiposLocal.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>{tipo.descricao}</option>
            ))}
          </CampoSelecao>
        </SecaoFormulario>

        <SecaoFormulario numero={2} titulo="Endereço do evento"
          descricao="Onde o fornecedor precisa chegar.">
          <Campo label="CEP" name="cep" value={campos.cep} onChange={aoDigitar}
            inputMode="numeric" autoComplete="postal-code"
            erro={erros.cep} placeholder="Somente números"
            validar={(v) => v.replace(/\D/g, '').length === 8
              ? null
              : 'Informe um CEP com 8 dígitos.'} />

          <Campo label="Rua" name="rua" value={campos.rua} onChange={aoDigitar} erro={erros.rua}
            autoComplete="address-line1"
            validar={(v) => v.trim().length >= 2 ? null : 'Informe a rua.'} />

          {/* Número e complemento são curtos, então dividem a linha até no
              celular; os outros pares só se dividem a partir do sm. */}
          <div className="grid grid-cols-2 gap-5">
            <Campo label="Número" name="numero" value={campos.numero}
              inputMode="numeric"
              onChange={aoDigitar} erro={erros.numero}
              validar={(v) => v.trim().length >= 1 ? null : 'Informe o número.'} />
            <Campo label="Complemento" name="complemento" value={campos.complemento}
              onChange={aoDigitar} erro={erros.complemento} placeholder="Opcional" />
          </div>

          <Campo label="Bairro" name="bairro" value={campos.bairro}
            onChange={aoDigitar} erro={erros.bairro}
            validar={(v) => v.trim().length >= 2 ? null : 'Informe o bairro.'} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="Cidade" name="cidade" value={campos.cidade}
              autoComplete="address-level2"
              onChange={aoDigitar} erro={erros.cidade}
              validar={(v) => v.trim().length >= 2 ? null : 'Informe a cidade.'} />
            <CampoSelecao label="Estado" name="estado" value={campos.estado}
              onChange={aoDigitar} erro={erros.estado}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </CampoSelecao>
          </div>
        </SecaoFormulario>

        <SecaoFormulario numero={3} titulo="Detalhes da festa"
          descricao="Opcional, mas ajuda o fornecedor a se preparar.">
          <Campo label="Tema" name="tema" value={campos.tema}
            onChange={aoDigitar} erro={erros.tema}
            placeholder="Ex.: fundo do mar" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="Nome do aniversariante" name="nomeAniversariante"
              value={campos.nomeAniversariante} onChange={aoDigitar}
              erro={erros.nomeAniversariante} />
            <Campo label="Idade" name="idadeAniversariante" type="number" min="0" max="255"
              value={campos.idadeAniversariante} onChange={aoDigitar}
              erro={erros.idadeAniversariante} />
          </div>

          <CampoTexto label="Observações" name="observacoes" rows={3}
            value={campos.observacoes} onChange={aoDigitar} erro={erros.observacoes}
            placeholder="Alguma restrição alimentar, acesso ao local, horário de montagem." />
        </SecaoFormulario>

        {/* RF028/RN029 — o total fica fora das seções e maior que tudo:
            é o número que a pessoa confere antes de enviar, e depois do
            envio ele não muda. */}
        <div className="rounded-2xl border border-festa-200 bg-festa-50 p-5 sm:p-6">
          <p className="text-sm text-slate-600">Valor total</p>
          {/* Enquanto falta o campo que multiplica o preço, o lugar do
              total dizia só "—", que não informa nada. Agora ele diz qual
              campo destrava a conta. */}
          {valorFinal === null ? (
            <p className="mt-1 text-base font-medium text-slate-500">
              Informe {faltaParaTotal} para ver o total.
            </p>
          ) : (
            <p className="mt-0.5 text-3xl font-semibold text-festa-800">
              {formatarPreco(valorFinal)}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            {EXPLICACAO_COBRANCA[servico.cobranca]}
          </p>
          <p className="mt-3 flex items-start gap-2 border-t border-festa-200 pt-3 text-xs text-slate-600">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-festa-600" aria-hidden="true" />
            O envio confirma este valor, e ele não é negociado depois. Os demais dados
            também não podem ser alterados — para mudar algo, é preciso enviar uma
            nova solicitação.
          </p>
        </div>

        {erroGeral && (
          <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erroGeral}
          </p>
        )}

        <button type="button" onClick={enviar} disabled={enviando}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </div>
    </main>
  );
}
