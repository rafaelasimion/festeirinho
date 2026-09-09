import { pool } from '@/lib/db';

// Este arquivo fala com o banco, então só pode ser importado por código de
// servidor. É por isso que ele não vive dentro de solicitacao.js: aquele é
// importado por componentes de tela ('use client'), e uma tela não pode
// carregar o driver do MySQL.

// RN035 — esgotado o prazo sem resposta, a solicitação expira.
//
// O ideal seria uma tarefa agendada rodando de tempos em tempos. Sem ela,
// a expiração é aplicada no momento em que alguém olha a lista: antes de
// mostrar qualquer solicitação, o sistema fecha as que já venceram. O
// efeito para o usuário é o mesmo, e nenhuma solicitação vencida chega a
// ser exibida como se ainda estivesse aberta.
export async function expirarSolicitacoesVencidas() {
  await pool.execute(
    `UPDATE solicitacao
        SET status = 'expirado',
            data_resposta_fornecedor = NOW()
      WHERE status = 'aguardando_analise'
        AND data_limite_resposta_fornecedor < NOW()`
  );
}