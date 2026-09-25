import { pool } from '@/lib/db';
import { obterConfiguracoes } from '@/lib/configuracao';

// RF005 / RF005-C / RN043 / RN047 — inativação automática por ausência de
// login.
//
// O caminho de volta já existe e não passa por aqui: o fluxo 6c do UC 003
// devolve a conta a "ativo" no primeiro login bem-sucedido. Esta função só
// cuida da ida.
//
// Numa plataforma em produção, isto seria uma tarefa agendada rodando de
// madrugada. Aqui é chamada quando a administração abre o painel, que é
// onde o efeito é observado. A limitação é conhecida e vale registrar como
// tal na documentação.

export async function marcarContasInativas() {
  const configuracoes = await obterConfiguracoes();

  try {
    // Conta recém-criada que nunca entrou conta a partir do cadastro:
    // sem o COALESCE, ela nunca seria alcançada pela regra.
    await pool.execute(
      `UPDATE cliente c
         JOIN usuario u ON u.id = c.id_usuario
          SET c.status_cliente = 'inativo'
        WHERE c.status_cliente = 'ativo'
          AND DATE_ADD(COALESCE(u.data_ultimo_login, u.data_cadastro),
                       INTERVAL ? DAY) < NOW()`,
      [configuracoes.periodo_inatividade_cliente_dias]
    );

    // RF005-C — "pausado" fica de fora: é decisão voluntária do fornecedor,
    // e sobrepor a ela uma inativação automática apagaria a diferença entre
    // quem escolheu sair de cena e quem apenas sumiu.
    await pool.execute(
      `UPDATE fornecedor f
         JOIN usuario u ON u.id = f.id_usuario
          SET f.status_fornecedor = 'inativo'
        WHERE f.status_fornecedor = 'ativo'
          AND DATE_ADD(COALESCE(u.data_ultimo_login, u.data_cadastro),
                       INTERVAL ? DAY) < NOW()`,
      [configuracoes.periodo_inatividade_fornecedor_dias]
    );
  } catch (erro) {
    // Manutenção que falha não pode impedir o painel de abrir.
    console.error('[marcarContasInativas]', erro);
  }
}
