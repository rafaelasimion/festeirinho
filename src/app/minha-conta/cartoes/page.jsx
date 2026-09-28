import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { pool } from '@/lib/db';
import ListaCartoes from './lista';

// RF032 / RF032-B — UC 029 e UC 030.
// Cartão é coisa de quem paga, então a tela é só do cliente.

export const metadata = {
  title: 'Cartões salvos · Festeirinho',
};

export default async function Cartoes() {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  if (sessao.tipoUsuario !== 'cliente') redirect('/minha-conta');

  const [cartoes] = await pool.execute(
    `SELECT c.id, c.bandeira, c.ultimos_quatro_num, c.apelido
       FROM cartao_credito c
       JOIN cliente cl ON cl.id = c.id_cliente
      WHERE cl.id_usuario = ? AND c.status = 'ativo'
      ORDER BY c.id DESC`,
    [sessao.id]
  );

  return <ListaCartoes cartoesIniciais={cartoes} />;
}
