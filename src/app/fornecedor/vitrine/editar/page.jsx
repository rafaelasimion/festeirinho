import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import FormularioVitrine from './formulario';

// UC 008 — a tela de edição dos dados da vitrine.
//
// Endereço fixo, como /fornecedor/vitrine: quem chega aqui é sempre o dono,
// e o id sai da sessão. Não existe editar a vitrine de outra pessoa, então
// não há id na rota — e, não havendo, não há como pedir uma que não seja a
// sua.
export default async function EditarVitrine() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'fornecedor') redirect('/minha-conta');

  const [linhas] = await pool.execute(
    `SELECT id, nome_exibicao, descricao, whatsapp_url, instagram_url, site,
            status_verificacao
       FROM fornecedor
      WHERE id_usuario = ? LIMIT 1`,
    [sessao.id]
  );
  if (linhas.length === 0) redirect('/minha-conta');

  const f = linhas[0];

  return (
    <FormularioVitrine
      fornecedor={{
        id: f.id,
        nomeExibicao: f.nome_exibicao ?? '',
        descricao: f.descricao ?? '',
        whatsappUrl: f.whatsapp_url ?? '',
        instagramUrl: f.instagram_url ?? '',
        site: f.site ?? '',
        statusVerificacao: f.status_verificacao,
      }}
    />
  );
}
