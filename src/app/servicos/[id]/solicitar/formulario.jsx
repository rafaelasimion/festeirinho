'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS } from '@/lib/validacao';
import { calcularValorFinal, formatarPreco } from '@/lib/solicitacao';

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
  const cobrancaPorHora = servico.cobranca === 'hora';
  const multiplicador = cobrancaPorHora
    ? Number(campos.duracao)
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
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{servico.nome}</h1>
      <p className="mb-6 text-sm text-gray-600">
        {servico.fornecedor} · {formatarPreco(servico.precoBase)}
        {cobrancaPorHora ? ' por hora' : ' por pessoa'}
      </p>

      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-700">Sobre o evento</p>

        <Campo label="Data e hora do evento" name="dataHoraEvento" type="datetime-local"
          min={dataMinima(servico.diasAntecedencia)}
          value={campos.dataHoraEvento} onChange={aoDigitar} erro={erros.dataHoraEvento}
          dica={`Este serviço exige ao menos ${servico.diasAntecedencia} dias de antecedência.`} />

        <Campo label="Duração (horas)" name="duracao" type="number" step="0.5" min="0.5"
          value={campos.duracao} onChange={aoDigitar} erro={erros.duracao} />

        <Campo label="Número de convidados" name="numeroConvidados" type="number" min="1"
          value={campos.numeroConvidados} onChange={aoDigitar} erro={erros.numeroConvidados}
          dica={servico.capacidadeMax !== null
            ? `Capacidade máxima deste serviço: ${servico.capacidadeMax} convidados.`
            : null} />

        <div>
          <label htmlFor="idTipoLocal" className="mb-1 block text-sm font-medium">
            Tipo de local
          </label>
          <select id="idTipoLocal" name="idTipoLocal" value={campos.idTipoLocal}
            onChange={aoDigitar} className="w-full rounded border border-gray-300 px-3 py-2">
            <option value="">Selecione</option>
            {tiposLocal.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>{tipo.descricao}</option>
            ))}
          </select>
          {erros.idTipoLocal && <p className="mt-1 text-sm text-red-600">{erros.idTipoLocal}</p>}
        </div>

        <p className="pt-2 text-sm font-medium text-gray-700">Endereço do evento</p>

        <Campo label="CEP" name="cep" value={campos.cep} onChange={aoDigitar}
          erro={erros.cep} placeholder="Somente números" />

        <Campo label="Rua" name="rua" value={campos.rua} onChange={aoDigitar} erro={erros.rua} />

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Número" name="numero" value={campos.numero}
            onChange={aoDigitar} erro={erros.numero} />
          <Campo label="Complemento" name="complemento" value={campos.complemento}
            onChange={aoDigitar} erro={erros.complemento} />
        </div>

        <Campo label="Bairro" name="bairro" value={campos.bairro}
          onChange={aoDigitar} erro={erros.bairro} />

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Cidade" name="cidade" value={campos.cidade}
            onChange={aoDigitar} erro={erros.cidade} />
          <div>
            <label htmlFor="estado" className="mb-1 block text-sm font-medium">Estado</label>
            <select id="estado" name="estado" value={campos.estado} onChange={aoDigitar}
              className="w-full rounded border border-gray-300 px-3 py-2">
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            {erros.estado && <p className="mt-1 text-sm text-red-600">{erros.estado}</p>}
          </div>
        </div>

        <p className="pt-2 text-sm font-medium text-gray-700">Detalhes da festa (opcional)</p>

        <Campo label="Tema" name="tema" value={campos.tema}
          onChange={aoDigitar} erro={erros.tema} />

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nome do aniversariante" name="nomeAniversariante"
            value={campos.nomeAniversariante} onChange={aoDigitar} erro={erros.nomeAniversariante} />
          <Campo label="Idade" name="idadeAniversariante" type="number" min="0" max="255"
            value={campos.idadeAniversariante} onChange={aoDigitar} erro={erros.idadeAniversariante} />
        </div>

        <div>
          <label htmlFor="observacoes" className="mb-1 block text-sm font-medium">
            Observações
          </label>
          <textarea id="observacoes" name="observacoes" rows={3} value={campos.observacoes}
            onChange={aoDigitar} className="w-full rounded border border-gray-300 px-3 py-2" />
        </div>

        <div className="rounded border border-gray-300 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Valor total</p>
          <p className="text-xl font-semibold">
            {valorFinal === null ? '—' : formatarPreco(valorFinal)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {cobrancaPorHora
              ? 'Preço por hora multiplicado pela duração informada.'
              : 'Preço por pessoa multiplicado pelo número de convidados.'}
            {' '}O envio da solicitação confirma este valor; não há negociação depois.
          </p>
        </div>

        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <button type="button" onClick={enviar} disabled={enviando}
          className="w-full rounded bg-gray-900 px-4 py-2.5 text-white disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Enviar solicitação'}
        </button>

        <p className="text-xs text-gray-500">
          Os dados informados não podem ser alterados depois do envio. Se precisar
          mudar algo, será necessário enviar uma nova solicitação.
        </p>
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