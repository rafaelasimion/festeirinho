import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import { assuntoValido } from '@/lib/suporte';
import FormularioSuporte from './formulario';

// UC 039 — Contatar suporte. A pré-condição é "não se aplica": esta tela
// abre logada ou deslogada. Quem está logado ganha a identificação já
// preenchida na mensagem; quem não está segue pelo fluxo 2a, sem contexto.

export const metadata = {
  title: 'Suporte · Festeirinho',
};

export default async function Suporte({ searchParams }) {
  const consulta = await searchParams;

  const sessao = await lerSessao();

  // Identificação de quem escreve. Vai no corpo da mensagem para o
  // atendente saber com quem fala sem precisar perguntar.
  let usuario = null;
  if (sessao) {
    const [linhas] = await pool.execute(
      'SELECT nome, email, tipo_usuario FROM usuario WHERE id = ?',
      [sessao.id]
    );
    if (linhas[0]) {
      usuario = {
        nome: linhas[0].nome,
        email: linhas[0].email,
        tipoUsuario: linhas[0].tipo_usuario,
      };
    }
  }

  // UC 039, passo 2 — contexto de origem. O número da solicitação chega
  // pela URL (?solicitacao=42), então precisa ser conferido: só entra na
  // mensagem se a solicitação existir E o usuário logado for parte dela.
  // Sem essa conferência, trocar o número na URL revelaria o nome do
  // serviço de contratações alheias.
  let contexto = null;
  const idSolicitacao = Number(consulta?.solicitacao);

  if (sessao && Number.isInteger(idSolicitacao) && idSolicitacao > 0) {
    const [linhas] = await pool.execute(
      `SELECT so.id, s.nome AS servico
         FROM solicitacao so
         JOIN servico s    ON s.id = so.id_servico
         JOIN cliente c    ON c.id = so.id_cliente
         JOIN fornecedor f ON f.id = s.id_fornecedor
        WHERE so.id = ?
          AND (c.id_usuario = ? OR f.id_usuario = ?)
        LIMIT 1`,
      [idSolicitacao, sessao.id, sessao.id]
    );

    if (linhas[0]) {
      contexto = {
        idSolicitacao: linhas[0].id,
        servico: linhas[0].servico,
        origem: ['pagamento', 'solicitacao', 'financeiro', 'conta']
          .includes(consulta?.origem) ? consulta.origem : null,
      };
    }
    // Se não encontrou, `contexto` fica nulo e a tela cai no fluxo
    // alternativo 2a — atendimento sem pré-preenchimento de contexto.
  }

  // RN063 — os canais são externos. Os endereços ficam em variável de
  // ambiente, não no código: o e-mail do suporte muda sem recompilar
  // nada, e o número do WhatsApp pode nem existir ainda.
  const canais = {
    email: process.env.SUPORTE_EMAIL || null,
    whatsapp: process.env.SUPORTE_WHATSAPP || null,
  };

  const assuntoInicial = assuntoValido(consulta?.assunto) ? consulta.assunto : '';

  return (
    <FormularioSuporte
      usuario={usuario}
      contexto={contexto}
      canais={canais}
      assuntoInicial={assuntoInicial}
    />
  );
}
