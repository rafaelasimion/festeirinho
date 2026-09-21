'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Campo from '@/componentes/campo';
import {
  TIPOS_RECEBIMENTO,
  TIPOS_CHAVE_PIX,
  TIPOS_CONTA,
  validarDadosRecebimento,
} from '@/lib/recebimento';

// Formulário "Forma de recebimento" (UC 036, UC 037).
//
// Serve ao saque do fornecedor e ao reembolso do cliente: a estrutura é a
// mesma, só muda quem é o titular. O titular vem pré-preenchido com os
// dados da própria conta, porque a RN061 exige que os dados pertençam a ele.

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

export default function FormularioRecebimento({
  titular,            // { nome, documento } — pré-preenchimento
  motivoRejeicao,     // quando é reenvio após rejeição (RN061)
  rotuloBotao = 'Enviar',
  processando,
  erroServidor,
  aoEnviar,
  aoVoltar,
}) {
  const [campos, setCampos] = useState({
    tipoRecebimento: 'pix',
    tipoChavePix: '',
    chavePix: '',
    banco: '',
    tipoConta: '',
    agencia: '',
    numeroConta: '',
    nomeTitular: titular?.nome ?? '',
    cpfCnpjTitular: titular?.documento ?? '',
  });
  const [erros, setErros] = useState({});

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
  }

  function enviar() {
    // A mesma validação que o servidor aplica. Aqui é conveniência: o
    // servidor valida tudo de novo.
    const resultado = validarDadosRecebimento(campos);
    if (Object.keys(resultado.erros).length > 0) {
      setErros(resultado.erros);
      return;
    }
    aoEnviar(campos);
  }

  const ehPix = campos.tipoRecebimento === 'pix';

  return (
    <div className="space-y-4">
      {motivoRejeicao && (
        <div className="flex gap-3 rounded-lg border border-perigo-200 bg-perigo-50 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-perigo-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-800">Os dados anteriores foram rejeitados</p>
            <p className="mt-0.5 text-slate-700">{motivoRejeicao}</p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Forma de recebimento</legend>
        <div className="grid grid-cols-2 gap-3">
          {TIPOS_RECEBIMENTO.map(({ valor, rotulo }) => (
            <label key={valor}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-festa-600/40 ${
                campos.tipoRecebimento === valor
                  ? 'border-festa-600 bg-festa-50 text-festa-800'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
              <input type="radio" name="tipoRecebimento" value={valor}
                checked={campos.tipoRecebimento === valor}
                onChange={aoDigitar} className="sr-only" />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      {ehPix ? (
        <>
          <div>
            <label htmlFor="tipoChavePix" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipo da chave
            </label>
            <select id="tipoChavePix" name="tipoChavePix" value={campos.tipoChavePix}
              onChange={aoDigitar} className={CLASSE_SELECT}>
              <option value="">Selecione</option>
              {TIPOS_CHAVE_PIX.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
            {erros.tipoChavePix && <p className="mt-1 text-sm text-red-600">{erros.tipoChavePix}</p>}
          </div>
          <Campo label="Chave Pix" name="chavePix" value={campos.chavePix}
            onChange={aoDigitar} erro={erros.chavePix} />
        </>
      ) : (
        <>
          <Campo label="Banco" name="banco" value={campos.banco}
            onChange={aoDigitar} erro={erros.banco} placeholder="Ex.: Banco do Brasil" />
          <div>
            <label htmlFor="tipoConta" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tipo de conta
            </label>
            <select id="tipoConta" name="tipoConta" value={campos.tipoConta}
              onChange={aoDigitar} className={CLASSE_SELECT}>
              <option value="">Selecione</option>
              {TIPOS_CONTA.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
            {erros.tipoConta && <p className="mt-1 text-sm text-red-600">{erros.tipoConta}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Agência" name="agencia" value={campos.agencia}
              onChange={aoDigitar} erro={erros.agencia} placeholder="Somente números" />
            <Campo label="Conta com dígito" name="numeroConta" value={campos.numeroConta}
              onChange={aoDigitar} erro={erros.numeroConta} placeholder="12345-6" />
          </div>
        </>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-3 text-xs text-slate-600">
          Os dados precisam pertencer ao titular desta conta. Uma conta de terceiro
          é recusada na validação.
        </p>
        <div className="space-y-3">
          <Campo label="Nome do titular" name="nomeTitular" value={campos.nomeTitular}
            onChange={aoDigitar} erro={erros.nomeTitular} />
          <Campo label="CPF ou CNPJ do titular" name="cpfCnpjTitular"
            value={campos.cpfCnpjTitular} onChange={aoDigitar} erro={erros.cpfCnpjTitular} />
        </div>
      </div>

      {erroServidor && <p className="text-sm text-red-600">{erroServidor}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={enviar} disabled={processando}
          className="rounded-lg bg-festa-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {processando ? 'Enviando...' : rotuloBotao}
        </button>
        {aoVoltar && (
          <button type="button" onClick={aoVoltar} disabled={processando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}
