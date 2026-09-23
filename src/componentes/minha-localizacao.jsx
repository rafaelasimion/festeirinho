'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CapturaLocalizacao from '@/componentes/captura-localizacao';

// RF066 / RN068 — captura da localização no perfil, depois do cadastro.
//
// O CapturaLocalizacao só conversa com o navegador e devolve o par de
// coordenadas; quem grava é este componente. A separação existe porque o
// mesmo captador serve ao cadastro, onde as coordenadas viajam junto com o
// resto do formulário e não são gravadas em separado.

export default function MinhaLocalizacao({ coordenadas: iniciais, descricao }) {
  const router = useRouter();
  const [coordenadas, setCoordenadas] = useState(iniciais ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function persistir(novas) {
    setErro('');
    setMensagem('');
    setSalvando(true);

    // Remover manda DELETE; as duas colunas são anuladas juntas, porque a
    // CHECK do banco não admite meia coordenada.
    const requisicao = novas
      ? fetch('/api/perfil/localizacao', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(novas),
        })
      : fetch('/api/perfil/localizacao', { method: 'DELETE' });

    try {
      const resposta = await requisicao;
      let dados;
      try {
        dados = await resposta.json();
      } catch {
        setErro(`O servidor respondeu ${resposta.status} sem conteúdo válido.`);
        return;
      }
      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível salvar a localização.');
        return;
      }

      setCoordenadas(dados.latitude === null ? null : dados);
      setMensagem(dados.latitude === null
        ? 'Localização removida.'
        : 'Localização salva.');
      router.refresh();
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <CapturaLocalizacao
        coordenadas={coordenadas}
        aoAlterar={persistir}
        descricao={descricao} />
      {salvando && <p className="text-xs text-slate-500">Salvando...</p>}
      {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
