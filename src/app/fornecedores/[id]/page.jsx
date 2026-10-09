import { notFound } from 'next/navigation';
import { pool } from '@/lib/db';
import { lerSessao } from '@/lib/sessao';
import Vitrine from './vitrine';
import { paraSerializar } from '@/lib/datas';
import { nomeAbreviado } from '@/lib/avaliacao';

// RF072 / UC 045 — vitrine do fornecedor.
//
// Uma tela, duas visões. Para o cliente é a página pública do fornecedor:
// quem é, onde atende, o que oferece e o que dizem dele. Para o próprio
// fornecedor é a mesma página, com o botão de editar os dados da vitrine,
// os serviços ainda não aprovados e o motivo de cada recusa.
//
// Ter as duas na mesma tela não é economia de código: é o fornecedor ver
// exatamente o que o cliente vê, e não uma aproximação.

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [linhas] = await pool.execute(
    'SELECT nome_exibicao FROM fornecedor WHERE id = ? LIMIT 1',
    [Number(id) || 0]
  );
  return { title: linhas[0] ? `${linhas[0].nome_exibicao} · Festeirinho` : 'Festeirinho' };
}

export default async function PaginaVitrine({ params }) {
  const { id } = await params;
  const idFornecedor = Number(id);
  if (!Number.isInteger(idFornecedor)) notFound();

  const sessao = await lerSessao();
  const ehCliente = sessao?.tipoUsuario === 'cliente';

  // Quem está olhando é o dono? A conferência é pelo id do usuário da
  // sessão contra o dono do fornecedor — nunca por um parâmetro da URL.
  const [donos] = await pool.execute(
    'SELECT id_usuario FROM fornecedor WHERE id = ? LIMIT 1',
    [idFornecedor]
  );
  if (donos.length === 0) notFound();
  const ehDono = Boolean(sessao) && donos[0].id_usuario === sessao.id;

  // RN068 — a distância só existe quando os dois lados têm coordenadas.
  // Sem elas, a vitrine mostra apenas a cidade, como a busca faz.
  const selecaoDistancia = ehCliente
    ? `(SELECT ST_Distance_Sphere(
           POINT(u.longitude, u.latitude),
           POINT(uc.longitude, uc.latitude)) / 1000
         FROM usuario uc
        WHERE uc.id = ?
          AND uc.latitude IS NOT NULL
          AND u.latitude IS NOT NULL) AS distancia_km`
    : 'NULL AS distancia_km';

  const valores = ehCliente ? [sessao.id, idFornecedor] : [idFornecedor];

  // RN020 — para o cliente, fornecedor indisponível não tem vitrine. O
  // dono continua enxergando a própria, para poder arrumar o que falta.
  const [fornecedores] = await pool.execute(
    `SELECT f.id, f.nome_exibicao, f.descricao, f.status_verificacao,
            f.status_fornecedor, f.raio_atendimento_km,
            f.instagram_url, f.whatsapp_url, f.site,
            f.motivo_rejeicao,
            u.cidade, u.estado, u.foto_perfil,
            ${selecaoDistancia}
       FROM fornecedor f
       JOIN usuario u ON u.id = f.id_usuario
      WHERE f.id = ?
      LIMIT 1`,
    valores
  );

  const fornecedor = fornecedores[0];
  if (!fornecedor) notFound();
  if (!ehDono && fornecedor.status_fornecedor !== 'ativo') notFound();

  // RF014 — as categorias do fornecedor não são cadastradas: saem dos
  // serviços que ele mantém ativos e aprovados. Um fornecedor que parou de
  // oferecer decoração deixa de aparecer como decorador sozinho.
  const [categorias] = await pool.execute(
    `SELECT DISTINCT c.nome
       FROM servico s
       JOIN categoria c ON c.id = s.id_categoria
      WHERE s.id_fornecedor = ?
        AND s.status_servico = 'ativo'
        AND s.status_verificacao = 'aprovado'
      ORDER BY c.nome`,
    [idFornecedor]
  );

  // O dono vê todos os seus serviços, com status e motivo de recusa. O
  // cliente vê só o que está no ar.
  const filtroServicos = ehDono
    ? ''
    : "AND s.status_servico = 'ativo' AND s.status_verificacao = 'aprovado'";

  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia, s.status_servico, s.status_verificacao,
            s.motivo_rejeicao,
            c.nome AS categoria, cb.descricao AS cobranca,
            fp.imagem_url AS foto_principal,
            av.media_nota, av.total_avaliacoes
       FROM servico s
       JOIN categoria c ON c.id = s.id_categoria
       JOIN cobranca cb ON cb.id = s.id_cobranca
       LEFT JOIN foto_servico fp
              ON fp.id_servico = s.id AND fp.principal = TRUE
       LEFT JOIN (
            SELECT so.id_servico,
                   AVG(a.nota) AS media_nota,
                   COUNT(*) AS total_avaliacoes
              FROM avaliacao a
              JOIN solicitacao so ON so.id = a.id_solicitacao
             GROUP BY so.id_servico
       ) av ON av.id_servico = s.id
      WHERE s.id_fornecedor = ? ${filtroServicos}
      ORDER BY s.data_cadastro DESC`,
    [idFornecedor]
  );

  // RN062 — a média usa TODAS as notas do fornecedor, inclusive as de
  // avaliações com comentário oculto. Só o texto é que fica restrito.
  const [resumo] = await pool.execute(
    `SELECT AVG(a.nota) AS media, COUNT(*) AS total,
            SUM(a.nota = 5) AS n5, SUM(a.nota = 4) AS n4,
            SUM(a.nota = 3) AS n3, SUM(a.nota = 2) AS n2,
            SUM(a.nota = 1) AS n1
       FROM avaliacao a
       JOIN solicitacao so ON so.id = a.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
      WHERE s.id_fornecedor = ?`,
    [idFornecedor]
  );

  const avaliacoes = {
    media: resumo[0].media === null ? null : Number(resumo[0].media),
    total: Number(resumo[0].total),
    distribuicao: [5, 4, 3, 2, 1].map((nota) => ({
      nota,
      quantidade: Number(resumo[0][`n${nota}`] ?? 0),
    })),
  };

  const [comentarios] = await pool.execute(
    `SELECT a.id, a.nota, a.comentario, a.data_avaliacao,
            u.nome AS cliente, uc.foto_perfil
       FROM avaliacao a
       JOIN solicitacao so ON so.id = a.id_solicitacao
       JOIN servico s      ON s.id  = so.id_servico
       JOIN cliente cl     ON cl.id = so.id_cliente
       JOIN usuario u      ON u.id  = cl.id_usuario
       JOIN usuario uc     ON uc.id = cl.id_usuario
      WHERE s.id_fornecedor = ?
        AND a.status_avaliacao = 'visivel'
        AND a.comentario IS NOT NULL
      ORDER BY a.data_avaliacao DESC
      LIMIT 30`,
    [idFornecedor]
  );

  // RF016 — o coração é do cliente. O fornecedor navega na vitrine
  // (RN030), mas não favorita.
  let favorito = false;
  if (ehCliente) {
    const [linhas] = await pool.execute(
      `SELECT 1 FROM favorito fv
         JOIN cliente c ON c.id = fv.id_cliente
        WHERE c.id_usuario = ? AND fv.id_fornecedor = ?
        LIMIT 1`,
      [sessao.id, idFornecedor]
    );
    favorito = linhas.length > 0;
  }

  return (
    <Vitrine
      fornecedor={{
        id: fornecedor.id,
        nomeExibicao: fornecedor.nome_exibicao,
        descricao: fornecedor.descricao,
        statusVerificacao: fornecedor.status_verificacao,
        statusFornecedor: fornecedor.status_fornecedor,
        raioAtendimentoKm: fornecedor.raio_atendimento_km,
        instagramUrl: fornecedor.instagram_url,
        whatsappUrl: fornecedor.whatsapp_url,
        site: fornecedor.site,
        motivoRejeicao: fornecedor.motivo_rejeicao,
        cidade: fornecedor.cidade,
        estado: fornecedor.estado,
        fotoPerfil: fornecedor.foto_perfil,
        distanciaKm: fornecedor.distancia_km === null
          ? null : Number(fornecedor.distancia_km),
      }}
      categorias={categorias.map((linha) => linha.nome)}
      servicos={servicos.map((servico) => ({
        ...servico,
        preco_base: Number(servico.preco_base),
        media_nota: servico.media_nota === null ? null : Number(servico.media_nota),
        total_avaliacoes: Number(servico.total_avaliacoes ?? 0),
      }))}
      avaliacoes={avaliacoes}
      comentarios={comentarios.map((c) => ({
        ...c,
        // O nome sai abreviado JÁ AQUI, no servidor: a vitrine é componente
        // de cliente, e o que vai nesta prop chega inteiro ao HTML da página,
        // apareça ou não na tela (RNF018).
        cliente: nomeAbreviado(c.cliente),
        data_avaliacao: paraSerializar(c.data_avaliacao),
      }))}
      ehDono={ehDono}
      ehCliente={ehCliente}
      favorito={favorito}
    />
  );
}
