'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Trash2, Info } from 'lucide-react';
import Campo from '@/componentes/campo';
import {
  formatarNumero, formatarValidade, detectarBandeira,
  validarLuhn, validarValidade, validarCVV, somenteDigitos,
} from '@/lib/cartao';

const CAMPOS_INICIAIS = {
  numero: '', nomeImpresso: '', validade: '', cvv: '', apelido: '',
};

export default function ListaCartoes({ cartoesIniciais }) {
  const [cartoes, setCartoes] = useState(cartoesIniciais);
  const [campos, setCampos] = useState(CAMPOS_INICIAIS);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(null);

  // A bandeira aparece no cartão da prévia enquanto a pessoa digita —
  // é o retorno de que o número está sendo lido corretamente.
  const bandeira = detectarBandeira(campos.numero);

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    const formatado =
      name === 'numero' ? formatarNumero(value)
      : name === 'validade' ? formatarValidade(value)
      : name === 'cvv' ? somenteDigitos(value).slice(0, 4)
      : value;

    setCampos((anterior) => ({ ...anterior, [name]: formatado }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
  }

  async function salvar() {
    setErroGeral('');
    setMensagem('');
    setErros({});
    setSalvando(true);

    try {
      const resposta = await fetch('/api/cartoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErroGeral(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }

      if (!resposta.ok) {
        if (dados.erros) setErros(dados.erros);
        else setErroGeral(dados.erro ?? 'Não foi possível salvar o cartão.');
        return;
      }

      // O formulário é limpo na hora: número, validade e CVV não devem
      // continuar na tela depois de enviados.
      setCampos(CAMPOS_INICIAIS);
      setCartoes((anteriores) => [dados, ...anteriores]);
      setMensagem('Cartão salvo.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id) {
    setErroGeral('');
    setMensagem('');
    setRemovendo(id);

    try {
      const resposta = await fetch(`/api/cartoes/${id}`, { method: 'DELETE' });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível remover o cartão.');
        return;
      }

      setCartoes((anteriores) => anteriores.filter((c) => c.id !== id));
      setMensagem('Cartão removido.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setRemovendo(null);
    }
  }

  const numeroValido = validarLuhn(campos.numero) && bandeira !== null;
  const podeSalvar =
    numeroValido
    && campos.nomeImpresso.trim().length >= 3
    && validarValidade(campos.validade)
    && validarCVV(campos.cvv, bandeira);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/minha-conta"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Cartões salvos</h1>
      <p className="mt-1 text-slate-600">
        Cartões cadastrados ficam disponíveis na hora de pagar uma contratação.
      </p>

      {/* Prévia: o cartão se preenche conforme a pessoa digita. */}
      <div className="mt-6 rounded-2xl bg-festa-600 p-5 text-white">
        <div className="flex items-start justify-between">
          <CreditCard className="h-7 w-7" aria-hidden="true" />
          <span className="text-sm font-medium">{bandeira ?? 'Bandeira'}</span>
        </div>
        <p className="mt-6 font-mono text-lg tracking-widest">
          {campos.numero || '•••• •••• •••• ••••'}
        </p>
        <div className="mt-5 flex items-end justify-between gap-3 text-sm">
          <span className="min-w-0 truncate uppercase">
            {campos.nomeImpresso || 'Nome no cartão'}
          </span>
          <span className="shrink-0">{campos.validade || 'MM/AA'}</span>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <Campo label="Número do cartão" name="numero" value={campos.numero}
          onChange={aoDigitar} erro={erros.numero} placeholder="0000 0000 0000 0000"
          inputMode="numeric" autoComplete="cc-number" />

        <Campo label="Nome impresso no cartão" name="nomeImpresso"
          value={campos.nomeImpresso} onChange={aoDigitar} erro={erros.nomeImpresso}
          placeholder="Como está no cartão" autoComplete="cc-name" />

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Validade" name="validade" value={campos.validade}
            onChange={aoDigitar} erro={erros.validade} placeholder="MM/AA"
            inputMode="numeric" autoComplete="cc-exp" />

          <Campo label="CVV" name="cvv" value={campos.cvv}
            onChange={aoDigitar} erro={erros.cvv} placeholder="123"
            inputMode="numeric" autoComplete="cc-csc" />
        </div>

        <Campo label="Apelido do cartão (opcional)" name="apelido"
          value={campos.apelido} onChange={aoDigitar} erro={erros.apelido}
          placeholder="Ex.: cartão principal" maxLength={50} />

        {/* RN013 dita, e a pessoa merece saber. */}
        <div className="flex gap-3 rounded-xl bg-festa-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-festa-600" aria-hidden="true" />
          <p className="text-sm text-slate-700">
            Seus dados são processados por um gateway de pagamento externo.
            Guardamos apenas os quatro últimos dígitos, a bandeira e um token —
            nunca o número completo nem o código de segurança.
          </p>
        </div>

        {erroGeral && (
          <p className="rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
            {erroGeral}
          </p>
        )}
        {mensagem && (
          <p className="rounded-xl bg-sucesso-50 px-4 py-3 text-sm text-sucesso-800">
            {mensagem}
          </p>
        )}

        <button type="button" onClick={salvar} disabled={salvando || !podeSalvar}
          className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar cartão'}
        </button>
      </div>

      <section className="mt-10">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Cartões cadastrados
        </h2>

        {cartoes.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Você ainda não tem cartões salvos.
          </p>
        ) : (
          <ul className="space-y-2">
            {cartoes.map((cartao) => (
              <li key={cartao.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-festa-100">
                  <CreditCard className="h-5 w-5 text-festa-600" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {cartao.bandeira} •••• {cartao.ultimos_quatro_num}
                  </p>
                  {cartao.apelido && (
                    <p className="text-sm text-slate-500">{cartao.apelido}</p>
                  )}
                </div>

                <button type="button" onClick={() => remover(cartao.id)}
                  disabled={removendo === cartao.id}
                  aria-label={`Remover ${cartao.bandeira} final ${cartao.ultimos_quatro_num}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-perigo-600 transition-colors hover:bg-perigo-50 disabled:opacity-50">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
