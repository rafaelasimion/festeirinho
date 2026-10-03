import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { paraSerializar } from '@/lib/datas';
import ListaNotificacoes from './lista';

// UC 017 / RF064 — central de notificações.

export const metadata = { title: 'Notificações — Festeirinho' };

export default async function Notificacoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const ehFornecedor = sessao.tipoUsuario === 'fornecedor';

  // UC 017, etapa 3 — ordem cronológica decrescente.
  const [notificacoes] = await pool.execute(
    `SELECT id, tipo, titulo, mensagem, id_solicitacao, lida, data_criacao
       FROM notificacao WHERE id_usuario = ?
      ORDER BY data_criacao DESC, id DESC
      LIMIT 100`,
    [sessao.id]
  );

  // UC 017, etapa 4 — marca como lidas as que acabaram de ser exibidas.
  //
  // A leitura acontece DEPOIS da consulta, de propósito: a lista que vai
  // para a tela ainda carrega quem estava por ler, e é dela que o destaque
  // sai. Marcar antes apagaria o destaque justamente na tela em que ele
  // importa.
  //
  // A CHECK da tabela exige "lida" e a data de leitura preenchidas juntas.
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  if (naoLidas > 0) {
    await pool.execute(
      `UPDATE notificacao SET lida = TRUE, data_leitura = NOW()
        WHERE id_usuario = ? AND lida = FALSE`,
      [sessao.id]
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Notificações</h1>

      <ListaNotificacoes
        notificacoes={serializar(notificacoes)}
        ehFornecedor={ehFornecedor}
      />
    </main>
  );
}

// `lida` é TINYINT no MySQL e chega como 0/1; a data vira texto, como em
// todo o sistema.
function serializar(linhas) {
  return linhas.map((linha) => ({
    ...linha,
    lida: Boolean(linha.lida),
    data_criacao: paraSerializar(linha.data_criacao),
  }));
}
