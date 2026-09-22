'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, Loader2 } from 'lucide-react';

// RF012 — gerenciamento das fotos de um serviço.
//
// O componente carrega a própria lista e conversa direto com a rota de
// fotos, então a tela de serviços só precisa renderizá-lo.

export default function GerenciarFotos({ idServico, aoAlterar }) {
  const entrada = useRef(null);
  const [fotos, setFotos] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const endereco = `/api/fornecedor/servicos/${idServico}/fotos`;

  async function carregar() {
    try {
      const resposta = await fetch(endereco);
      if (!resposta.ok) {
        setErro('Não foi possível carregar as fotos.');
        return;
      }
      setFotos(await resposta.json());
    } catch {
      setErro('Falha de conexão ao carregar as fotos.');
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idServico]);

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
      if (dados.voltouParaVerificacao) {
        setAviso('Como as fotos mudaram, o serviço voltou para análise e saiu da vitrine até a nova aprovação.');
      }
      await carregar();
      aoAlterar?.();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  function enviar(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;

    // Envio de arquivo usa FormData, não JSON. O navegador monta o corpo
    // multipart e define o Content-Type sozinho — por isso ele não é
    // informado aqui.
    const formulario = new FormData();
    formulario.append('foto', arquivo);
    executar(() => fetch(endereco, { method: 'POST', body: formulario }));
  }

  function definirPrincipal(idFoto) {
    executar(() => fetch(endereco, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idFoto }),
    }));
  }

  function remover(idFoto) {
    executar(() => fetch(`${endereco}?idFoto=${idFoto}`, { method: 'DELETE' }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          JPG, PNG ou WEBP, até 5 MB. A foto principal é a que aparece na vitrine.
        </p>
        <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={enviar} className="sr-only" id={`foto-${idServico}`} />
        <label htmlFor={`foto-${idServico}`}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-festa-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-festa-700 ${
            processando ? 'pointer-events-none opacity-50' : ''}`}>
          {processando
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          Adicionar foto
        </label>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-atencao-700">{aviso}</p>}

      {fotos === null ? (
        <p className="text-sm text-slate-500">Carregando fotos...</p>
      ) : fotos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          Nenhuma foto ainda. Serviços com foto chamam mais atenção na vitrine.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((foto) => (
            <li key={foto.id}
              className={`overflow-hidden rounded-lg border ${
                foto.principal ? 'border-festa-600 ring-2 ring-festa-600/30' : 'border-slate-200'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.imagem_url} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-1 bg-white p-2">
                {foto.principal ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-festa-700">
                    <Star className="h-3.5 w-3.5 fill-festa-600 text-festa-600" aria-hidden="true" />
                    Principal
                  </span>
                ) : (
                  <button type="button" onClick={() => definirPrincipal(foto.id)}
                    disabled={processando}
                    className="text-xs font-medium text-festa-700 hover:underline disabled:opacity-50">
                    Tornar principal
                  </button>
                )}
                <button type="button" onClick={() => remover(foto.id)} disabled={processando}
                  aria-label="Remover foto"
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-perigo-50 hover:text-perigo-700 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
