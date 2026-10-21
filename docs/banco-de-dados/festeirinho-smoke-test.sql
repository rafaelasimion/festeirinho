-- =====================================================================
-- FESTEIRINHO — Smoke test do caminho feliz
-- Uso: mysql < festeirinho-smoke-test.sql
-- Pré-requisito: festeirinho-ddl.sql já aplicado
--
-- Percorre dois cenários completos:
--   A) contratação → pagamento → conclusão → avaliação → repasse → saque
--   B) contratação → pagamento → cancelamento pelo cliente com multa → repasse da multa
-- =====================================================================

USE festeirinho;
SET @HASH = CONCAT('$2b$12$', REPEAT('x', 53));   -- bcrypt fictício de 60 chars

-- Administrador responsável pelas verificações dos passos 2 e 3 (RF071)
INSERT INTO administrador (nome, email, senha_hash)
VALUES ('Administração Festeirinho', 'admin@exemplo.com', @HASH);
SET @adm = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- 1. Cadastro de cliente (UC 001)
-- ---------------------------------------------------------------------
INSERT INTO usuario (tipo_usuario, nome, nome_usuario, email, telefone, senha_hash, estado, cidade)
VALUES ('cliente', 'Ana Souza', 'ana.souza', 'ana@exemplo.com', '16999990001', @HASH, 'SP', 'Franca');
SET @u_cli = LAST_INSERT_ID();

INSERT INTO cliente (id_usuario, cpf, data_nascimento)
VALUES (@u_cli, '11144477735', '1990-05-14');
SET @cli = LAST_INSERT_ID();

-- ---------------------------------------------------------------------
-- 2. Cadastro de fornecedor PF (UC 002) e verificação (UC 024)
-- ---------------------------------------------------------------------
INSERT INTO usuario (tipo_usuario, nome, nome_usuario, email, telefone, senha_hash, estado, cidade)
VALUES ('fornecedor', 'Bruno Lima', 'bruno.lima', 'bruno@exemplo.com', '16999990002', @HASH, 'SP', 'Franca');
SET @u_for = LAST_INSERT_ID();

INSERT INTO fornecedor (id_usuario, tipo_pessoa, cpf, data_nascimento, nome_exibicao, descricao)
VALUES (@u_for, 'PF', '52998224725', '1988-03-22', 'Bruno Animações', 'Recreação e personagens para festas infantis');
SET @forn = LAST_INSERT_ID();

UPDATE fornecedor SET status_verificacao = 'aprovado', data_verificacao = NOW() WHERE id = @forn;

-- ---------------------------------------------------------------------
-- 3. Cadastro e moderação de serviço (UC 008, UC 025)
-- ---------------------------------------------------------------------
INSERT INTO servico (id_fornecedor, id_categoria, id_cobranca, nome, descricao,
                     preco_base, capacidade_max, dias_antecedencia)
SELECT @forn, c.id, cb.id, 'Recreação infantil completa',
       'Dois recreadores, jogos, pintura facial e oficina de balões.',
       250.00, 60, 5
  FROM categoria c, cobranca cb
 WHERE c.nome = 'Animação' AND cb.descricao = 'hora';
SET @serv = LAST_INSERT_ID();

INSERT INTO foto_servico (id_servico, imagem_url, principal) VALUES
  (@serv, 'https://cdn.festeirinho.com/s1-capa.jpg', TRUE),
  (@serv, 'https://cdn.festeirinho.com/s1-02.jpg',   FALSE),
  (@serv, 'https://cdn.festeirinho.com/s1-03.jpg',   FALSE);

UPDATE servico SET status_verificacao = 'aprovado' WHERE id = @serv;

-- Favoritos: um serviço e um fornecedor para o mesmo cliente (RN003, RN004)
INSERT INTO favorito (id_cliente, tipo_favorito, id_servico)    VALUES (@cli, 'servico', @serv);
INSERT INTO favorito (id_cliente, tipo_favorito, id_fornecedor) VALUES (@cli, 'fornecedor', @forn);

-- =====================================================================
-- CENÁRIO A — contratação concluída com sucesso
-- =====================================================================

-- 4. Solicitação (UC 013). valor_final = preco_base x duracao = 250,00 x 4 = 1.000,00
INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro, complemento)
VALUES ('SP', 'Franca', '14400000', 'Rua das Acácias', '250', 'Centro', 'Casa 2');
SET @end_a = LAST_INSERT_ID();

-- id_cobranca congela o tipo de cobrança do serviço no envio, como o preço
-- em valor_referencia (RN029).
INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
                         data_hora_evento, duracao, numero_convidados, tema,
                         nome_aniversariante, idade_aniversariante,
                         valor_referencia, valor_final, data_limite_resposta_fornecedor)
SELECT @cli, @serv, @end_a, tl.id,
       (SELECT id_cobranca FROM servico WHERE id = @serv),
       NOW() + INTERVAL 20 DAY, 4.0, 35, 'Circo',
       'Miguel', 6, 250.00, 1000.00, NOW() + INTERVAL 48 HOUR
  FROM tipo_local tl WHERE tl.descricao = 'Residência';
SET @sol_a = LAST_INSERT_ID();

-- 5. Fornecedor aprova (UC 015)
UPDATE solicitacao
   SET status = 'aguardando_pagamento', data_resposta_fornecedor = NOW()
 WHERE id = @sol_a;

-- 6. Sistema gera o pagamento (RF030, RN027): comissão 10% -> 100,00; repasse 900,00
--
-- Os quatro percentuais de multa da RN050 sao congelados aqui junto com a
-- comissao, como o lib/pagamento-servidor.js faz: quem contratou hoje segue
-- sob as faixas anunciadas hoje, mesmo que a administracao as mude amanha.
-- As colunas sao NOT NULL sem default, entao omiti-las derruba o INSERT.
INSERT INTO pagamento (id_solicitacao, valor_bruto, percentual_comissao, valor_comissao,
                       valor_repassado,
                       perc_multa_faixa_mais_7d, perc_multa_faixa_7d_48h,
                       perc_multa_faixa_48h_24h, perc_multa_faixa_24h,
                       data_limite)
SELECT @sol_a, s.valor_final, cfg.valor,
       ROUND(s.valor_final * cfg.valor / 100, 2),
       s.valor_final - ROUND(s.valor_final * cfg.valor / 100, 2),
       (SELECT valor FROM configuracao WHERE chave = 'multa_cancelamento_faixa_mais_7d'),
       (SELECT valor FROM configuracao WHERE chave = 'multa_cancelamento_faixa_7d_48h'),
       (SELECT valor FROM configuracao WHERE chave = 'multa_cancelamento_faixa_48h_24h'),
       (SELECT valor FROM configuracao WHERE chave = 'multa_cancelamento_faixa_24h'),
       NOW() + INTERVAL 24 HOUR
  FROM solicitacao s, configuracao cfg
 WHERE s.id = @sol_a AND cfg.chave = 'percentual_comissao';
SET @pag_a = LAST_INSERT_ID();

-- 7. Cliente paga via Pix; webhook confirma (UC 018, RF047)
UPDATE pagamento
   SET forma_pagamento = 'pix', status = 'processando',
       id_transacao_gateway = 'GW-PIX-0001'
 WHERE id = @pag_a;

UPDATE pagamento SET status = 'pago', data_pagamento = NOW() WHERE id = @pag_a;
UPDATE solicitacao SET status = 'confirmado' WHERE id = @sol_a;

-- 8. Chat operacional (UC 016)
INSERT INTO mensagem (id_solicitacao, id_usuario, conteudo) VALUES
  (@sol_a, @u_for, 'Boa tarde! Chegamos 40 minutos antes para montar a estrutura.'),
  (@sol_a, @u_cli, 'Perfeito. O portão da garagem estará aberto a partir das 13h.');
UPDATE mensagem SET lida = TRUE WHERE id_solicitacao = @sol_a AND id_usuario = @u_for;

-- 9. Conclusão em duas etapas (UC 019, UC 020)
UPDATE solicitacao SET data_registro_conclusao_fornecedor = NOW() WHERE id = @sol_a;
UPDATE solicitacao
   SET data_confirmacao_conclusao_cliente = NOW(), status = 'concluido'
 WHERE id = @sol_a;

-- 10. Avaliação pública (UC 021)
INSERT INTO avaliacao (id_solicitacao, nota, comentario)
VALUES (@sol_a, 5, 'Equipe pontual e as crianças amaram a oficina de balões.');

-- 11. Liberação do repasse após a carência (RF054, RN056)
UPDATE pagamento SET status_repasse = 'liberado', data_repasse = NOW() WHERE id = @pag_a;

-- =====================================================================
-- CENÁRIO B — cancelamento pelo cliente com multa de 25% (RN050 faixa 7d-48h)
-- =====================================================================

INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro)
VALUES ('SP', 'Franca', '14401000', 'Avenida Brasil', '1180', 'Jardim Aeroporto');
SET @end_b = LAST_INSERT_ID();

INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
                         data_hora_evento, duracao, numero_convidados,
                         valor_referencia, valor_final, data_limite_resposta_fornecedor,
                         status, data_resposta_fornecedor)
SELECT @cli, @serv, @end_b, tl.id,
       (SELECT id_cobranca FROM servico WHERE id = @serv),
       NOW() + INTERVAL 4 DAY, 4.0, 20, 250.00, 1000.00,
       NOW() + INTERVAL 12 HOUR, 'confirmado', NOW()
  FROM tipo_local tl WHERE tl.descricao = 'Salão';
SET @sol_b = LAST_INSERT_ID();

-- As faixas de multa tambem aqui, pelo mesmo motivo do passo 6. Os valores
-- literais sao os que o DDL semeia na configuracao (0%, 25%, 50%, 100%).
INSERT INTO pagamento (id_solicitacao, valor_bruto, percentual_comissao, valor_comissao,
                       valor_repassado,
                       perc_multa_faixa_mais_7d, perc_multa_faixa_7d_48h,
                       perc_multa_faixa_48h_24h, perc_multa_faixa_24h,
                       forma_pagamento, status, id_transacao_gateway,
                       data_limite, data_pagamento)
VALUES (@sol_b, 1000.00, 10.00, 100.00, 900.00,
        0.00, 25.00, 50.00, 100.00,
        'boleto', 'pago', 'GW-BOL-0002',
        NOW() + INTERVAL 24 HOUR, NOW());
SET @pag_b = LAST_INSERT_ID();

-- Cliente cancela a 4 dias do evento: faixa "7d-48h" -> 25% multa, 75% reembolso
-- valor_multa e status_repasse gravados na mesma instrução (exigência do CHECK)
INSERT INTO cancelamento (id_solicitacao, solicitado_por, motivo,
                          valor_reembolso, valor_multa, status_repasse)
VALUES (@sol_b, 'cliente', 'Mudança na data da festa por motivo familiar.',
        750.00, 250.00, 'pendente');
SET @canc_b = LAST_INSERT_ID();

UPDATE solicitacao SET status = 'cancelado' WHERE id = @sol_b;

-- Pagamento foi boleto: cliente informa dados de recebimento (UC 036, RN061)
INSERT INTO dados_recebimento (id_cancelamento, tipo_recebimento, chave_pix, tipo_chave_pix,
                               cpf_cnpj_titular, nome_titular)
VALUES (@canc_b, 'pix', 'ana@exemplo.com', 'email', '11144477735', 'Ana Souza');
SET @dr_b = LAST_INSERT_ID();

-- Administração valida (UC 038) e o estorno é confirmado (RN053, RN040)
UPDATE dados_recebimento SET status_validacao = 'validado' WHERE id = @dr_b;
UPDATE cancelamento SET status = 'processando' WHERE id = @canc_b;
UPDATE cancelamento SET status = 'concluido'  WHERE id = @canc_b;
UPDATE pagamento SET status = 'estornado', status_repasse = 'cancelado' WHERE id = @pag_b;

-- Repasse da multa ao fornecedor, sem carência (RF055, RN057)
UPDATE cancelamento SET status_repasse = 'liberado', data_repasse = NOW() WHERE id = @canc_b;

-- =====================================================================
-- 12. Saque do saldo disponível (UC 037, RN060)
--     saldo = 900,00 (repasse do cenário A) + 250,00 (multa do cenário B) = 1.150,00
-- =====================================================================
INSERT INTO saque (id_fornecedor, valor) VALUES (@forn, 1000.00);
SET @saq = LAST_INSERT_ID();

INSERT INTO dados_recebimento (id_saque, tipo_recebimento, banco, tipo_conta,
                               agencia, numero_conta, cpf_cnpj_titular, nome_titular)
VALUES (@saq, 'conta_bancaria', 'Banco do Brasil', 'corrente',
        '1234', '567890', '52998224725', 'Bruno Lima');
SET @dr_s = LAST_INSERT_ID();

UPDATE dados_recebimento SET status_validacao = 'validado' WHERE id = @dr_s;
UPDATE saque SET status = 'processando', id_transacao_gateway = 'GW-TED-0003' WHERE id = @saq;
UPDATE saque SET status = 'concluido', data_processamento = NOW() WHERE id = @saq;

-- ---------------------------------------------------------------------
-- 13. Notificações (RF064-B, RN065)
-- ---------------------------------------------------------------------
INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem, id_solicitacao) VALUES
  (@u_cli, 'pagamento',    'Pagamento confirmado',  'Seu pagamento foi aprovado e a festa está confirmada.', @sol_a),
  (@u_for, 'solicitacao',  'Nova solicitação',      'Você recebeu uma nova solicitação de serviço.',         @sol_a),
  (@u_cli, 'cancelamento', 'Cancelamento concluído','Seu reembolso de R$ 750,00 foi processado.',            @sol_b),
  (@u_for, 'financeiro',   'Saque concluído',       'A transferência de R$ 1.000,00 foi confirmada.',        NULL);

UPDATE notificacao SET lida = TRUE, data_leitura = NOW() WHERE id_usuario = @u_cli;

-- =====================================================================
-- VERIFICAÇÕES
-- =====================================================================

SELECT '--- Cenário A: fluxo concluído ---' AS ``;
SELECT s.id, s.status AS status_solicitacao, s.valor_final,
       p.status AS status_pagamento, p.valor_comissao, p.valor_repassado, p.status_repasse,
       a.nota
  FROM solicitacao s
  JOIN pagamento p ON p.id_solicitacao = s.id
  LEFT JOIN avaliacao a ON a.id_solicitacao = s.id
 WHERE s.id = @sol_a;

SELECT '--- Cenário B: cancelamento com multa ---' AS ``;
SELECT s.id, s.status AS status_solicitacao,
       c.solicitado_por, c.valor_reembolso, c.valor_multa,
       c.status AS status_cancelamento, c.status_repasse,
       p.status AS status_pagamento
  FROM solicitacao s
  JOIN cancelamento c ON c.id_solicitacao = s.id
  JOIN pagamento p    ON p.id_solicitacao = s.id
 WHERE s.id = @sol_b;

SELECT '--- Cobrança congelada no envio (RN029) ---' AS ``;
SELECT s.id, s.valor_referencia, cb.descricao AS cobranca_contratada, s.valor_final
  FROM solicitacao s JOIN cobranca cb ON cb.id = s.id_cobranca
 WHERE s.id IN (@sol_a, @sol_b);

SELECT '--- Saldo do fornecedor (RN060) ---' AS ``;
SELECT f.nome_exibicao, v.saldo_disponivel,
       (SELECT SUM(valor) FROM saque WHERE id_fornecedor = f.id
         AND status IN ('pendente','processando','concluido')) AS total_sacado
  FROM vw_saldo_fornecedor v
  JOIN fornecedor f ON f.id = v.id_fornecedor;

SELECT '--- Central de notificações (RF064) ---' AS ``;
SELECT u.nome_usuario, SUM(n.lida = FALSE) AS nao_lidas, COUNT(*) AS total
  FROM notificacao n JOIN usuario u ON u.id = n.id_usuario
 GROUP BY u.nome_usuario ORDER BY u.nome_usuario;
