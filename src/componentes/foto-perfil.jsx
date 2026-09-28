'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2 } from 'lucide-react';

// Foto de perfil do usuário logado (RF001, RF002, RF004).
//
// Sem foto, mostra as iniciais do nome — mais pessoal que um ícone genérico
// e já distingue uma conta da outra numa lista.

function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// layout 'linha'    — foto à esquerda, botões ao lado (telas de formulário)
// layout 'centrado' — foto grande no centro, com o botão de trocar sobreposto
//                     num canto (cabeçalho da tela de perfil)
export default function FotoPerfil({
  fotoAtual, nome, avisoVerificacao = false, aoAlterar, layout = 'linha',
}) {
  const router = useRouter();
  const [foto, setFoto] = useState(fotoAtual ?? null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function executar(requisicao) {
    setErro('');
    setAviso('');
    setProcessando(true);
    try {
      const resposta = await requisicao();
      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível concluir a operação.');
        return;
      }
      setFoto(dados.fotoPerfil);
      if (dados.voltouParaVerificacao) {
        setAviso('Como a foto mudou, seu perfil voltou para verificação.');
      }
      aoAlterar?.(dados);
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  function enviar(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    const formulario = new FormData();
    formulario.append('foto', arquivo);
    executar(() => fetch('/api/perfil/foto', { method: 'POST', body: formulario }));
  }

  if (layout === 'centrado') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-dashed border-festa-300 bg-festa-100">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={`Foto de perfil de ${nome}`}
                className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-festa-700"
                aria-hidden="true">
                {iniciais(nome)}
              </span>
            )}
            {processando && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                <Loader2 className="h-6 w-6 animate-spin text-festa-600" aria-hidden="true" />
              </span>
            )}
          </div>

          {/* O label É o botão: clicar nele abre o seletor de arquivo do
              sistema. Um <button> não consegue fazer isso sem JavaScript. */}
          <input type="file" accept="image/jpeg,image/png,image/webp" id="foto-perfil"
            onChange={enviar} className="sr-only" />
          <label htmlFor="foto-perfil"
            title={foto ? 'Trocar foto' : 'Enviar foto'}
            className={`absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-festa-600 text-white transition-colors hover:bg-festa-700 ${
              processando ? 'pointer-events-none opacity-50' : ''}`}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{foto ? 'Trocar foto' : 'Enviar foto'}</span>
          </label>
        </div>

        {foto && (
          <button type="button" disabled={processando}
            onClick={() => executar(() => fetch('/api/perfil/foto', { method: 'DELETE' }))}
            className="mt-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50">
            Remover foto
          </button>
        )}

        {erro && <p className="mt-2 text-sm text-perigo-600">{erro}</p>}
        {aviso && <p className="mt-2 text-center text-sm text-atencao-700">{aviso}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-festa-100">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={`Foto de perfil de ${nome}`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-festa-700"
            aria-hidden="true">
            {iniciais(nome)}
          </span>
        )}
        {processando && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-festa-600" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input type="file" accept="image/jpeg,image/png,image/webp" id="foto-perfil"
            onChange={enviar} className="sr-only" />
          <label htmlFor="foto-perfil"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-festa-600 px-3 py-1.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50 ${
              processando ? 'pointer-events-none opacity-50' : ''}`}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            {foto ? 'Trocar foto' : 'Enviar foto'}
          </label>
          {foto && (
            <button type="button" disabled={processando}
              onClick={() => executar(() => fetch('/api/perfil/foto', { method: 'DELETE' }))}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50">
              Remover
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          JPG, PNG ou WEBP, até 5 MB.
          {avisoVerificacao && ' Trocar a foto envia o perfil para nova verificação.'}
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {aviso && <p className="text-sm text-atencao-700">{aviso}</p>}
      </div>
    </div>
  );
}
