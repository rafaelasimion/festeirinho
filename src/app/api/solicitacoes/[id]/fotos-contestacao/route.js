import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { paraSerializar } from '@/lib/datas';
import { parteDaContestacao } from '@/lib/fotos-contestacao-servidor';

// RF069-B / UC 042 / UC 046 — as fotos que a própria parte enviou, para ela
// rever o que mandou. Só leitura.
//
// Enviar foto não é mais aqui: as fotos entram junto com o relato de cada
// parte, numa vez só, pela rota /api/solicitacoes/[id]/contestacao (RN069).
// Esta rota deixou de ter POST e DELETE de propósito — com elas, a prova
// podia ganhar ou perder fotos no meio da análise.
//
// Decidida a contestação, as fotos já foram apagadas junto com a decisão.

export async function GET(request, { params }) {
  const { erro, idSolicitacao, papel, pendente } = await parteDaContestacao(params);
  if (erro) return erro;

  const [fotos] = await pool.execute(
    `SELECT id, imagem_url, data_envio FROM foto_contestacao
      WHERE id_solicitacao = ? AND enviado_por = ?
      ORDER BY id`,
    [idSolicitacao, papel]
  );

  return NextResponse.json({
    pendente,
    fotos: fotos.map((f) => ({ ...f, data_envio: paraSerializar(f.data_envio) })),
  });
}
