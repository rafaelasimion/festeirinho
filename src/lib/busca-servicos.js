import { pool } from '@/lib/db';

// RF014 / UC 011 — a consulta da vitrine de serviços.
//
// Mora aqui, e não dentro de uma página, porque agora duas telas mostram a
// vitrine: a busca (/servicos) e a tela inicial, que abre com os serviços
// que atendem o cliente. As duas precisam concordar sobre o que cada pessoa
// pode ver. Com o filtro de proximidade (RN068) escrito em dois lugares, um
// dia uma cópia mudaria sozinha e a tela inicial ofereceria um serviço que a
// busca esconde — ou esconderia um que a busca oferece.
//
// Só leitura: nada aqui grava no banco.

// A ordenação vem de uma lista fechada. O valor recebido da URL escolhe uma
// entrada da lista; ele NUNCA é colado no SQL. ORDER BY não aceita
// parâmetro "?", então esta lista é a única proteção possível ali.
export const ORDENACOES = {
  distancia: {
    rotulo: 'Mais perto de mim',
    // Fornecedor sem coordenada entrou pela regra de cidade; sem distância
    // para medir, vai ao fim da lista.
    sql: 'distancia_km IS NULL, distancia_km ASC',
  },
  recentes: { rotulo: 'Mais recentes', sql: 's.data_cadastro DESC' },
  avaliacao: {
    rotulo: 'Melhor avaliados',
    // Serviços sem avaliação vão para o fim, e não para o começo.
    sql: 'av.media_nota IS NULL, av.media_nota DESC, av.total_avaliacoes DESC',
  },
  menor_preco: { rotulo: 'Menor preço', sql: 's.preco_base ASC' },
  maior_preco: { rotulo: 'Maior preço', sql: 's.preco_base DESC' },
};

// No LIKE, % e _ são curingas. Sem escapar, quem digitasse "100%" buscaria
// "100 seguido de qualquer coisa". A barra invertida é o escape padrão do
// MySQL.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

// RN068 — o filtro de proximidade é do CLIENTE: é a localização dele que
// define quais fornecedores o alcançam. Visitante e fornecedor navegam na
// vitrine completa (RN030), então para eles não há o que ler.
export async function lerLocalizacaoCliente(sessao) {
  if (sessao?.tipoUsuario !== 'cliente') return null;

  const [linhas] = await pool.execute(
    'SELECT latitude, longitude, cidade, estado FROM usuario WHERE id = ? LIMIT 1',
    [sessao.id]
  );
  return linhas[0] ?? null;
}

export function temCoordenadas(localizacao) {
  return Boolean(localizacao && localizacao.latitude !== null);
}

// O WHERE da vitrine e os valores dos seus "?", na ordem em que aparecem.
function filtroDaVitrine({ localizacao, texto, idCategoria, cidade }) {
  // RN020 — só aparece o que está ativo e aprovado, de fornecedor ativo.
  const condicoes = [
    "s.status_servico = 'ativo'",
    "s.status_verificacao = 'aprovado'",
    "f.status_fornecedor = 'ativo'",
  ];
  const valores = [];

  // RN068 — proximidade. Com as duas coordenadas, vale a distância contra o
  // raio declarado pelo fornecedor. Faltando a de qualquer das partes, o
  // critério passa a ser cidade e estado iguais: ninguém é excluído da busca
  // por não ter autorizado a captura da localização.
  if (localizacao) {
    if (temCoordenadas(localizacao)) {
      condicoes.push(`(
             (u.latitude IS NOT NULL
               AND ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(?, ?))
                   <= f.raio_atendimento_km * 1000)
          OR (u.latitude IS NULL AND u.cidade = ? AND u.estado = ?))`);
      valores.push(
        localizacao.longitude, localizacao.latitude,
        localizacao.cidade, localizacao.estado
      );
    } else {
      condicoes.push('(u.cidade = ? AND u.estado = ?)');
      valores.push(localizacao.cidade, localizacao.estado);
    }
  }

  if (texto) {
    // Um termo busca em nome e descrição do serviço, no nome do fornecedor
    // e na categoria — é onde a pessoa espera encontrar o que digitou.
    condicoes.push(`(s.nome LIKE CONCAT('%', ?, '%')
                  OR s.descricao LIKE CONCAT('%', ?, '%')
                  OR f.nome_exibicao LIKE CONCAT('%', ?, '%')
                  OR c.nome LIKE CONCAT('%', ?, '%'))`);
    const termo = escaparLike(texto);
    valores.push(termo, termo, termo, termo);
  }

  if (idCategoria) {
    condicoes.push('s.id_categoria = ?');
    valores.push(idCategoria);
  }

  if (cidade) {
    condicoes.push(`u.cidade LIKE CONCAT('%', ?, '%')`);
    valores.push(escaparLike(cidade));
  }

  return { condicoes, valores };
}

// Os serviços que quem está olhando pode ver, já com média de avaliações,
// foto principal, favorito e distância.
//
// `localizacao` vem de lerLocalizacaoCliente; quem chama a lê uma vez e a
// usa também para escrever o aviso do filtro na tela.
export async function buscarServicos({
  sessao, localizacao = null, texto = '', idCategoria = null, cidade = '',
  ordem = 'recentes', limite = null,
}) {
  const ehCliente = sessao?.tipoUsuario === 'cliente';

  // Os valores da lista de seleção vêm ANTES dos do JOIN, e estes antes dos
  // do WHERE: a ordem dos "?" no comando é a ordem do array.
  const valoresSelecao = [];

  // ST_Distance_Sphere recebe POINT(longitude, latitude) — nessa ordem — e
  // devolve metros. Sem coordenada do cliente não há distância a calcular.
  let selecaoDistancia = 'NULL AS distancia_km';
  if (temCoordenadas(localizacao)) {
    selecaoDistancia = `ROUND(
              ST_Distance_Sphere(POINT(u.longitude, u.latitude), POINT(?, ?)) / 1000, 1
            ) AS distancia_km`;
    valoresSelecao.push(localizacao.longitude, localizacao.latitude);
  }

  // RF015 — o coração já nasce preenchido no que o cliente salvou.
  // favorito.id_cliente é o id da tabela cliente, e a sessão guarda o id
  // do usuário. A busca comparava um com o outro direto: como os ids de
  // usuário são divididos entre clientes e fornecedores, os dois quase
  // nunca coincidem, e o coração aparecia vazio no que o cliente salvou —
  // ou cheio no que OUTRO cliente salvou. A subconsulta faz a mesma
  // tradução que a página do serviço e a vitrine do fornecedor já faziam.
  // Visitante e fornecedor passam 0: nenhum cliente tem esse usuário, e a
  // coluna sai nula.
  const valoresJuncao = [ehCliente ? sessao.id : 0];

  const { condicoes, valores: valoresCondicao } = filtroDaVitrine({
    localizacao, texto, idCategoria, cidade,
  });

  const criterio = ORDENACOES[ordem] ?? ORDENACOES.recentes;

  // LIMIT também não aceita "?" no execute do mysql2, então o número entra
  // no texto — e só depois de conferido que é um inteiro positivo.
  const sqlLimite = Number.isInteger(limite) && limite > 0 ? ` LIMIT ${limite}` : '';

  // A média de avaliações vem de uma subconsulta agrupada. Entram TODAS as
  // notas, inclusive as de avaliação oculta: a RN062 esconde só o
  // comentário, nunca a nota.
  //
  // RN068 — latitude e longitude são dado pessoal e NÃO saem daqui: a
  // consulta devolve apenas cidade, estado e a distância calculada.
  //
  // O s.id no fim do ORDER BY desempata: sem ele, dois serviços com a mesma
  // nota ou a mesma distância podiam trocar de lugar entre um carregamento e
  // outro, e a tela inicial, que mostra só os primeiros, mudaria sozinha.
  // Crescente porque é a ordem em que o banco já os devolvia no empate, e
  // assim a busca continua com a cara de antes.
  const [servicos] = await pool.execute(
    `SELECT s.id, s.nome, s.descricao, s.preco_base, s.capacidade_max,
            s.dias_antecedencia,
            c.nome AS categoria, cb.descricao AS cobranca,
            f.nome_exibicao, f.status_verificacao AS verificacao_fornecedor,
            u.cidade, u.estado,
            av.media_nota, av.total_avaliacoes,
            fp.imagem_url AS foto_principal,
            fv.id AS id_favorito,
            ${selecaoDistancia}
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
       JOIN cobranca cb  ON cb.id = s.id_cobranca
       LEFT JOIN foto_servico fp ON fp.id_servico = s.id AND fp.principal = TRUE
       LEFT JOIN favorito fv ON fv.id_servico = s.id
             AND fv.id_cliente = (SELECT cl.id FROM cliente cl WHERE cl.id_usuario = ?)
       LEFT JOIN (
            SELECT so.id_servico,
                   AVG(a.nota)  AS media_nota,
                   COUNT(*)     AS total_avaliacoes
              FROM avaliacao a
              JOIN solicitacao so ON so.id = a.id_solicitacao
             GROUP BY so.id_servico
       ) av ON av.id_servico = s.id
      WHERE ${condicoes.join(' AND ')}
      ORDER BY ${criterio.sql}, s.id${sqlLimite}`,
    [...valoresSelecao, ...valoresJuncao, ...valoresCondicao]
  );

  return servicos;
}

// Quantos serviços quem está olhando encontra em cada categoria, com o
// mesmo filtro da vitrine. A tela inicial usa para oferecer só os atalhos
// que levam a algum resultado — um atalho que abre a busca vazia é um
// beco — e para dizer quantos serviços atendem a pessoa.
//
// Categoria sem serviço visível não volta: o JOIN é com servico.
export async function contarServicosPorCategoria({ localizacao = null } = {}) {
  const { condicoes, valores } = filtroDaVitrine({ localizacao });

  const [linhas] = await pool.execute(
    `SELECT c.id, c.nome, COUNT(*) AS total
       FROM servico s
       JOIN fornecedor f ON f.id = s.id_fornecedor
       JOIN usuario u    ON u.id = f.id_usuario
       JOIN categoria c  ON c.id = s.id_categoria
      WHERE ${condicoes.join(' AND ')}
      GROUP BY c.id, c.nome
      ORDER BY c.nome`,
    valores
  );

  return linhas.map((linha) => ({ ...linha, total: Number(linha.total) }));
}
