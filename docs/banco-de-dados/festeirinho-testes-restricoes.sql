-- =====================================================================
-- FESTEIRINHO — Testes de restrição
-- Uso: mysql --table < festeirinho-testes-restricoes.sql
-- Pré-requisitos: festeirinho-ddl.sql e festeirinho-smoke-test.sql aplicados
-- Atenção: exige o DDL com as constraints chk_fornecedor_suspensao,
-- chk_cliente_revisao e chk_fornecedor_revisao, com os CHECKs null-safe (<=>)
-- com a coluna solicitacao.id_cobranca (migração de 08/10), com a tabela
-- foto_contestacao (migração de 10/10) e com a versão do fornecedor na
-- contestação (migração de 10/10 b).
--
-- Cada teste executa uma instrução dentro de uma transação e a desfaz,
-- comparando o resultado com o esperado. Nada é persistido.
-- =====================================================================

USE festeirinho;

-- O Workbench abre a conexão em "safe update mode", que recusa DELETE e
-- UPDATE cujo WHERE não use coluna indexada (erro 1175). A limpeza abaixo
-- identifica suas linhas por texto — o motivo da denúncia, o endereço da
-- imagem —, que são exatamente colunas sem índice.
--
-- Desligar aqui vale só para esta conexão e é devolvido no fim do arquivo.
-- Executado por `mysql < arquivo.sql`, em que o modo já vem desligado,
-- estas duas linhas não mudam nada.
SET @modo_seguro_anterior = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS _resultado;
CREATE TABLE _resultado (
  seq       INT AUTO_INCREMENT PRIMARY KEY,
  teste     VARCHAR(6),
  regra     VARCHAR(24),
  situacao  VARCHAR(70),
  esperado  VARCHAR(10),
  obtido    VARCHAR(10),
  veredito  VARCHAR(6),
  detalhe   VARCHAR(180)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS teste;
DELIMITER $$
CREATE PROCEDURE teste(IN p_id VARCHAR(6), IN p_regra VARCHAR(24),
                       IN p_desc VARCHAR(70), IN p_esperado VARCHAR(10), IN p_sql TEXT)
BEGIN
  DECLARE v_obtido VARCHAR(10) DEFAULT 'aceite';
  DECLARE v_msg VARCHAR(180) DEFAULT '';
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
    SET v_obtido = 'bloqueio';
  END;

  START TRANSACTION;
  SET @_s = p_sql;
  PREPARE _st FROM @_s;
  EXECUTE _st;
  ROLLBACK;

  INSERT INTO _resultado (teste, regra, situacao, esperado, obtido, veredito, detalhe)
  VALUES (p_id, p_regra, p_desc, p_esperado, v_obtido,
          IF(v_obtido = p_esperado, 'OK', 'FALHA'), LEFT(v_msg, 180));
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Restos de uma execução anterior
--
-- A massa auxiliar é criada FORA dos testes e por isso não é desfeita pelo
-- rollback: numa segunda execução ela colidia com a primeira e o roteiro
-- parava no cartão de crédito (erro 1062). Apagá-la aqui torna o arquivo
-- repetível. Cada DELETE identifica apenas o que este roteiro cria; dados
-- do sistema não são tocados.
--
-- A ordem obedece às FKs, todas ON DELETE RESTRICT.
-- ---------------------------------------------------------------------
DELETE FROM denuncia WHERE motivo = 'Massa dos testes de restricao T48 e T49';
DELETE FROM foto_servico
 WHERE imagem_url = 'https://cdn.festeirinho.com/teste-restricoes-principal.jpg';

DELETE f FROM favorito f
  JOIN cliente c ON c.id = f.id_cliente
  JOIN usuario u ON u.id = c.id_usuario
 WHERE u.nome_usuario = 'cliente.teste.restricoes';
DELETE c FROM cliente c
  JOIN usuario u ON u.id = c.id_usuario
 WHERE u.nome_usuario = 'cliente.teste.restricoes';
DELETE FROM usuario WHERE nome_usuario = 'cliente.teste.restricoes';

-- Os testes T67 a T69 rodam dentro do harness e não deixam foto. Esta linha
-- cobre o caso de alguém ter aberto uma solicitação de teste no sistema e
-- anexado foto a ela: sem apagar a foto antes, o DELETE da solicitação,
-- logo abaixo, pararia na fk_foto_contestacao_solicitacao.
DELETE FROM foto_contestacao
 WHERE id_solicitacao IN (SELECT id FROM (
         SELECT so.id FROM solicitacao so JOIN endereco e ON e.id = so.id_endereco
          WHERE e.rua = 'Rua dos Testes de Restricao') AS s);

DELETE FROM solicitacao
 WHERE id_endereco IN (SELECT id FROM (
         SELECT id FROM endereco WHERE rua = 'Rua dos Testes de Restricao') AS e);
DELETE FROM endereco WHERE rua = 'Rua dos Testes de Restricao';
DELETE FROM cartao_credito WHERE token_gateway = 'tok_teste_0001';

-- ---------------------------------------------------------------------
-- Referências e massa auxiliar
-- ---------------------------------------------------------------------
SET @cli   = (SELECT id FROM cliente ORDER BY id LIMIT 1);
SET @u_cli = (SELECT id_usuario FROM cliente ORDER BY id LIMIT 1);
SET @forn  = (SELECT id FROM fornecedor ORDER BY id LIMIT 1);
SET @u_for = (SELECT id_usuario FROM fornecedor ORDER BY id LIMIT 1);
SET @serv  = (SELECT id FROM servico ORDER BY id LIMIT 1);
SET @sol_a = (SELECT id FROM solicitacao WHERE status = 'concluido' ORDER BY id LIMIT 1);
SET @sol_b = (SELECT id FROM solicitacao WHERE status = 'cancelado' ORDER BY id LIMIT 1);
SET @pag_a = (SELECT id FROM pagamento WHERE id_solicitacao = @sol_a);
SET @canc  = (SELECT id FROM cancelamento ORDER BY id LIMIT 1);
SET @saq   = (SELECT id FROM saque ORDER BY id LIMIT 1);
SET @tl    = (SELECT id FROM tipo_local ORDER BY id LIMIT 1);
-- RN029: a solicitação congela o tipo de cobrança do serviço no envio.
SET @cob   = (SELECT id_cobranca FROM servico WHERE id = @serv);

-- Cartão de crédito do cliente, para o teste da RN018
INSERT INTO cartao_credito (id_cliente, token_gateway, ultimos_quatro_num, bandeira, apelido)
VALUES (@cli, 'tok_teste_0001', '4242', 'Visa', 'Cartão principal');
SET @cartao = LAST_INSERT_ID();

-- Solicitação ATIVA de apoio (status "aguardando_analise"), sem pagamento,
-- sem cancelamento e sem avaliação, para servir de alvo dos testes
INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro)
VALUES ('SP', 'Franca', '14402000', 'Rua dos Testes de Restricao', '10', 'Centro');
SET @end_c = LAST_INSERT_ID();

INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
                         data_hora_evento, duracao, numero_convidados,
                         valor_referencia, valor_final, data_limite_resposta_fornecedor)
VALUES (@cli, @serv, @end_c, @tl, @cob, '2027-03-15 14:00:00', 4.0, 30,
        250.00, 1000.00, NOW() + INTERVAL 48 HOUR);
SET @sol_c = LAST_INSERT_ID();

INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro)
VALUES ('SP', 'Franca', '14402000', 'Rua dos Testes de Restricao', '10', 'Centro');
SET @end_d = LAST_INSERT_ID();

-- Cliente próprio dos testes, SEM nenhuma solicitação de revisão.
--
-- O T32 e o T33 provam que a chk_cliente_revisao recusa estados
-- incoerentes, e para isso o cliente precisa partir do estado "sem
-- revisão". Apontados para o primeiro cliente do banco, eles reprovavam
-- em qualquer base onde esse cliente já tivesse passado por uma revisão:
-- o UPDATE caía num ramo válido do CHECK e era aceito, sem haver defeito
-- algum. O T07 usa o mesmo cliente para não depender de quem favoritou o
-- quê.
INSERT INTO usuario (tipo_usuario, nome, nome_usuario, email, senha_hash, estado, cidade)
VALUES ('cliente', 'Cliente dos testes de restricao', 'cliente.teste.restricoes',
        'cliente.teste.restricoes@exemplo.invalid', REPEAT('x', 60), 'SP', 'Franca');
SET @u_cli_rev = LAST_INSERT_ID();

INSERT INTO cliente (id_usuario, cpf, data_nascimento)
VALUES (@u_cli_rev, '12345678909', '1995-01-01');
SET @cli_rev = LAST_INSERT_ID();

-- O T07 duplica um favorito; sem o primeiro, não há o que duplicar.
INSERT INTO favorito (id_cliente, tipo_favorito, id_servico)
VALUES (@cli_rev, 'servico', @serv);

-- O T05 insere a SEGUNDA foto principal do serviço; sem a primeira, a
-- uk_foto_principal não tem com o que colidir e o teste passa batido.
SET @tem_principal = (SELECT COUNT(*) FROM foto_servico
                       WHERE id_servico = @serv AND principal = TRUE);
INSERT INTO foto_servico (id_servico, imagem_url, principal)
SELECT @serv, 'https://cdn.festeirinho.com/teste-restricoes-principal.jpg', TRUE
  FROM DUAL WHERE @tem_principal = 0;

-- =====================================================================
-- IDENTIDADE E CADASTRO
-- =====================================================================
CALL teste('T01', 'RN055', 'Usuário do tipo cliente recebendo cadastro de fornecedor',
  'bloqueio',
  'INSERT INTO fornecedor (id_usuario, tipo_pessoa, cpf, data_nascimento, nome_exibicao, descricao)
   VALUES (@u_cli, ''PF'', ''39053344705'', ''1990-01-01'', ''Teste'', ''Teste'')');

-- O e-mail duplicado sai do próprio banco, em vez de um literal: assim o
-- teste vale em qualquer base, com ou sem o smoke test aplicado.
CALL teste('T02', 'RN002', 'E-mail repetido entre usuários',
  'bloqueio',
  'INSERT INTO usuario (tipo_usuario, nome, nome_usuario, email, senha_hash, estado, cidade)
   SELECT ''cliente'', ''Clone'', ''clone.teste'', u.email, REPEAT(''x'',60), ''SP'', ''Franca''
     FROM usuario u WHERE u.id = @u_cli');

CALL teste('T03', 'RN001', 'Fornecedor PF com CNPJ preenchido',
  'bloqueio',
  'UPDATE fornecedor SET cnpj = ''11222333000181'' WHERE id = @forn');

CALL teste('T04', 'RN044-C', 'DELETE físico de usuário com histórico vinculado',
  'bloqueio',
  'DELETE FROM usuario WHERE id = @u_cli');

-- A obrigatoriedade da data para PF é da aplicação, não do banco: o CHECK
-- verifica apenas o lado "deve ser NULL", para não colidir com a anonimização
-- da RN044-A. Por isso este UPDATE deve passar.
CALL teste('T60', 'RF002', 'Fornecedor PF com data de nascimento anulada (anonimização)',
  'aceite',
  'UPDATE fornecedor SET data_nascimento = NULL WHERE id = @forn');

CALL teste('T61', 'RF002', 'Fornecedor PJ com data de nascimento preenchida',
  'bloqueio',
  'UPDATE fornecedor SET tipo_pessoa = ''PJ'', cpf = NULL, cnpj = ''11222333000181'',
          razao_social = ''Teste LTDA'', data_nascimento = ''1990-01-01''
    WHERE id = @forn');

CALL teste('T62', 'RF071', 'Dois administradores com o mesmo e-mail',
  'bloqueio',
  'INSERT INTO administrador (nome, email, senha_hash)
   SELECT ''Duplicado'', email, senha_hash FROM administrador LIMIT 1');

-- =====================================================================
-- CATÁLOGO
-- =====================================================================
CALL teste('T05', 'RF012', 'Segunda foto marcada como principal no mesmo serviço',
  'bloqueio',
  'INSERT INTO foto_servico (id_servico, imagem_url, principal)
   VALUES (@serv, ''https://cdn/x.jpg'', TRUE)');

CALL teste('T06', 'RN003', 'Favorito referenciando serviço e fornecedor ao mesmo tempo',
  'bloqueio',
  'INSERT INTO favorito (id_cliente, tipo_favorito, id_servico, id_fornecedor)
   VALUES (@cli, ''servico'', @serv, @forn)');

CALL teste('T07', 'RN004', 'Favorito duplicado do mesmo serviço pelo mesmo cliente',
  'bloqueio',
  'INSERT INTO favorito (id_cliente, tipo_favorito, id_servico)
   VALUES (@cli_rev, ''servico'', @serv)');

-- =====================================================================
-- SOLICITAÇÃO
-- =====================================================================
CALL teste('T08', 'RN036/RF022', 'Segunda solicitação ATIVA para mesmo serviço, data e hora',
  'bloqueio',
  'INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
     data_hora_evento, duracao, numero_convidados, valor_referencia, valor_final,
     data_limite_resposta_fornecedor)
   VALUES (@cli, @serv, @end_d, @tl, @cob, ''2027-03-15 14:00:00'', 4.0, 30,
           250.00, 1000.00, NOW() + INTERVAL 48 HOUR)');

CALL teste('T09', 'RN009', 'Reaproveitar o mesmo endereço em outra solicitação',
  'bloqueio',
  'INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
     data_hora_evento, duracao, numero_convidados, valor_referencia, valor_final,
     data_limite_resposta_fornecedor)
   VALUES (@cli, @serv, @end_c, @tl, @cob, ''2027-06-01 10:00:00'', 4.0, 30,
           250.00, 1000.00, NOW() + INTERVAL 48 HOUR)');

CALL teste('T10', 'RN021', 'Solicitação recusada sem motivo padronizado',
  'bloqueio',
  'UPDATE solicitacao SET status = ''recusado'' WHERE id = @sol_c');

CALL teste('T11', 'RN028', 'Cliente confirmando conclusão que o fornecedor não registrou',
  'bloqueio',
  'UPDATE solicitacao SET data_confirmacao_conclusao_cliente = NOW() WHERE id = @sol_c');

-- =====================================================================
-- PAGAMENTO
-- =====================================================================
CALL teste('T12', 'RN027', 'Repasse divergente de valor_bruto menos comissão',
  'bloqueio',
  'INSERT INTO pagamento (id_solicitacao, valor_bruto, percentual_comissao,
     valor_comissao, valor_repassado, perc_multa_faixa_mais_7d, perc_multa_faixa_7d_48h,
     perc_multa_faixa_48h_24h, perc_multa_faixa_24h, data_limite)
   VALUES (@sol_c, 1000.00, 10.00, 100.00, 950.00, 0.00, 25.00, 50.00, 100.00,
           NOW() + INTERVAL 24 HOUR)');

CALL teste('T13', 'RN048', 'Quarta tentativa de pagamento',
  'bloqueio',
  'UPDATE pagamento SET numero_tentativas = 4 WHERE id = @pag_a');

CALL teste('T14', 'RN018', 'Pagamento via Pix vinculado a cartão de crédito',
  'bloqueio',
  'UPDATE pagamento SET forma_pagamento = ''pix'', id_cartao_credito = @cartao WHERE id = @pag_a');

CALL teste('T15', 'RN056', 'Repasse liberado sem data de liberação',
  'bloqueio',
  'UPDATE pagamento SET status_repasse = ''liberado'', data_repasse = NULL WHERE id = @pag_a');

-- =====================================================================
-- CANCELAMENTO
-- =====================================================================
CALL teste('T16', 'RN007', 'Segundo cancelamento para a mesma solicitação',
  'bloqueio',
  'INSERT INTO cancelamento (id_solicitacao, solicitado_por, motivo)
   VALUES (@sol_b, ''fornecedor'', ''Tentativa de segundo cancelamento'')');

CALL teste('T17', 'RN051', 'Cancelamento pelo fornecedor cobrando multa do cliente',
  'bloqueio',
  'INSERT INTO cancelamento (id_solicitacao, solicitado_por, motivo,
     valor_reembolso, valor_multa, status_repasse)
   VALUES (@sol_c, ''fornecedor'', ''Imprevisto'', 750.00, 250.00, ''pendente'')');

CALL teste('T18', 'RN066', 'Cancelamento automático pelo sistema cobrando multa',
  'bloqueio',
  'INSERT INTO cancelamento (id_solicitacao, solicitado_por, motivo,
     valor_reembolso, valor_multa, status_repasse)
   VALUES (@sol_c, ''sistema'', ''Sem registro de conclusão'', 0.00, 1000.00, ''pendente'')');

CALL teste('T19', 'RN057', 'Cancelamento sem multa com repasse pendente de liberação',
  'bloqueio',
  'INSERT INTO cancelamento (id_solicitacao, solicitado_por, motivo,
     valor_reembolso, valor_multa, status_repasse)
   VALUES (@sol_c, ''fornecedor'', ''Imprevisto'', 1000.00, 0.00, ''pendente'')');

-- =====================================================================
-- AVALIAÇÃO
-- =====================================================================
CALL teste('T20', 'RN006', 'Segunda avaliação para a mesma solicitação',
  'bloqueio',
  'INSERT INTO avaliacao (id_solicitacao, nota) VALUES (@sol_a, 4)');

CALL teste('T21', 'RF037', 'Nota fora da faixa de 1 a 5',
  'bloqueio',
  'INSERT INTO avaliacao (id_solicitacao, nota) VALUES (@sol_c, 6)');

CALL teste('T22', 'RN062', 'Ocultação por moderação sem motivo registrado',
  'bloqueio',
  'UPDATE avaliacao SET status_avaliacao = ''oculta'', origem_ocultacao = ''moderacao''
    WHERE id_solicitacao = @sol_a');

CALL teste('T23', 'RN062', 'Ocultação pelo próprio autor, sem motivo (deve passar)',
  'aceite',
  'UPDATE avaliacao SET status_avaliacao = ''oculta'', origem_ocultacao = ''usuario''
    WHERE id_solicitacao = @sol_a');

CALL teste('T24', 'RN052', 'Segunda denúncia para a mesma avaliação',
  'bloqueio',
  'INSERT INTO denuncia (tipo_denuncia, id_avaliacao, motivo_padrao, motivo)
   SELECT ''avaliacao'', a.id, ''conteudo_inadequado'', ''Duplicada''
     FROM avaliacao a WHERE a.id_solicitacao = @sol_a
   UNION ALL
   SELECT ''avaliacao'', a.id, ''conteudo_inadequado'', ''Duplicada''
     FROM avaliacao a WHERE a.id_solicitacao = @sol_a');

-- =====================================================================
-- FINANCEIRO
-- =====================================================================
CALL teste('T25', 'RN061', 'Dados de recebimento ligados a cancelamento E saque',
  'bloqueio',
  'INSERT INTO dados_recebimento (id_cancelamento, id_saque, tipo_recebimento,
     chave_pix, tipo_chave_pix, cpf_cnpj_titular, nome_titular)
   VALUES (@canc, @saq, ''pix'', ''x@y.com'', ''email'', ''11144477735'', ''Ana'')');

CALL teste('T26', 'RN061', 'Recebimento tipo Pix com dados bancários preenchidos',
  'bloqueio',
  'INSERT INTO dados_recebimento (id_saque, tipo_recebimento, chave_pix, tipo_chave_pix,
     banco, agencia, numero_conta, cpf_cnpj_titular, nome_titular)
   VALUES (NULL, ''pix'', ''x@y.com'', ''email'', ''Itaú'', ''1234'', ''5678'', ''111'', ''Ana'')');

CALL teste('T27', 'RN060', 'Saque com valor negativo',
  'bloqueio',
  'INSERT INTO saque (id_fornecedor, valor) VALUES (@forn, -50.00)');

CALL teste('T28', 'RN065', 'Notificação marcada como lida sem data de leitura',
  'bloqueio',
  'UPDATE notificacao SET lida = TRUE, data_leitura = NULL WHERE id_usuario = @u_for');

-- =====================================================================
-- LIBERAÇÃO APÓS STATUS TERMINAL
-- Prova que a trava de duplicidade (T08) solta quando a solicitação
-- anterior sai dos status ativos — comportamento exigido pela RF022.
-- =====================================================================
UPDATE solicitacao SET status = 'cancelado' WHERE id = @sol_c;

CALL teste('T29', 'RF022', 'Mesma combinação após a anterior virar "cancelado" (deve passar)',
  'aceite',
  'INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
     data_hora_evento, duracao, numero_convidados, valor_referencia, valor_final,
     data_limite_resposta_fornecedor)
   VALUES (@cli, @serv, @end_d, @tl, @cob, ''2027-03-15 14:00:00'', 4.0, 30,
           250.00, 1000.00, NOW() + INTERVAL 48 HOUR)');

-- =====================================================================
-- CONTA, SUSPENSÃO E REVISÃO
-- Cobre chk_cliente_suspensao, chk_fornecedor_suspensao,
-- chk_cliente_revisao e chk_fornecedor_revisao.
-- =====================================================================
CALL teste('T30', 'RN038', 'Cliente suspenso sem motivo e data registrados',
  'bloqueio',
  'UPDATE cliente SET status_cliente = ''suspenso'' WHERE id = @cli');

CALL teste('T31', 'RN054', 'Fornecedor suspenso sem motivo e data registrados',
  'bloqueio',
  'UPDATE fornecedor SET status_fornecedor = ''suspenso'' WHERE id = @forn');

-- T32 é o teste que expõe a armadilha do NULL: sem o operador null-safe (<=>)
-- no CHECK, esta combinação avalia para NULL e o MySQL a aceitaria.
CALL teste('T32', 'RF006', 'Revisão do cliente com motivo e data, porém sem status',
  'bloqueio',
  'UPDATE cliente SET motivo_solicitacao_revisao = ''Pedido de revisao'',
     data_solicitacao_revisao = NOW() WHERE id = @cli_rev');

CALL teste('T33', 'RF059', 'Revisão do cliente analisada sem resultado registrado',
  'bloqueio',
  'UPDATE cliente SET motivo_solicitacao_revisao = ''Pedido de revisao'',
     data_solicitacao_revisao = NOW(), status_solicitacao_revisao = ''analisada''
   WHERE id = @cli_rev');

CALL teste('T34', 'RF006-B', 'Revisão do fornecedor pendente já com resultado',
  'bloqueio',
  'UPDATE fornecedor SET motivo_solicitacao_revisao = ''Pedido de revisao'',
     data_solicitacao_revisao = NOW(), status_solicitacao_revisao = ''pendente'',
     resultado_solicitacao_revisao = ''Mantida'', data_analise_revisao = NOW()
   WHERE id = @forn');

-- Caso positivo: a revisão aprovada devolve a conta a "ativo" e o registro da
-- revisão permanece. Prova que o CHECK não amarrou a revisão à suspensão.
CALL teste('T35', 'RF059', 'Revisão aprovada, conta de volta a ativo (deve passar)',
  'aceite',
  'UPDATE cliente SET status_cliente = ''ativo'',
     motivo_solicitacao_revisao = ''Denuncia improcedente'',
     data_solicitacao_revisao = NOW() - INTERVAL 2 DAY,
     status_solicitacao_revisao = ''analisada'',
     resultado_solicitacao_revisao = ''Suspensao revertida'',
     data_analise_revisao = NOW() WHERE id = @cli');

-- Mesma armadilha do NULL, em constraint pré-existente: avaliação oculta sem
-- origem registrada não era barrada antes da correção de chk_avaliacao_ocultacao.
CALL teste('T36', 'RN062', 'Avaliação oculta sem origem de ocultação registrada',
  'bloqueio',
  'UPDATE avaliacao SET status_avaliacao = ''oculta''
    WHERE id_solicitacao = @sol_a');

-- =====================================================================
-- LOCALIZAÇÃO E RAIO DE ATENDIMENTO (RN068)
-- Cobre chk_usuario_geo e chk_fornecedor_raio.
-- =====================================================================
CALL teste('T37', 'RN068', 'Coordenada pela metade: latitude sem longitude',
  'bloqueio',
  'UPDATE usuario SET latitude = -20.538000, longitude = NULL WHERE id = @u_for');

CALL teste('T38', 'RN068', 'Latitude fora da faixa geográfica válida',
  'bloqueio',
  'UPDATE usuario SET latitude = 120.000000, longitude = -47.400000 WHERE id = @u_for');

CALL teste('T39', 'RN068', 'Raio de atendimento igual a zero',
  'bloqueio',
  'UPDATE fornecedor SET raio_atendimento_km = 0 WHERE id = @forn');

-- Caso positivo: par completo e dentro da faixa é aceito, e o par totalmente
-- nulo continua válido (usuário que não autorizou a captura, RN068/RN044-A).
CALL teste('T40', 'RN068', 'Coordenada completa e válida (deve passar)',
  'aceite',
  'UPDATE usuario SET latitude = -20.538000, longitude = -47.400000 WHERE id = @u_for');

CALL teste('T41', 'RN068', 'Coordenada ausente nos dois campos (deve passar)',
  'aceite',
  'UPDATE usuario SET latitude = NULL, longitude = NULL WHERE id = @u_for');

-- =====================================================================
-- MOTIVO DA REJEIÇÃO DOS DADOS DE RECEBIMENTO (RN061, RF062)
-- Cobre chk_dados_recebimento_rejeicao.
-- =====================================================================
CALL teste('T42', 'RN061', 'Dados de recebimento rejeitados sem motivo registrado',
  'bloqueio',
  'UPDATE dados_recebimento SET status_validacao = ''rejeitado'', motivo_rejeicao = NULL
    WHERE id_saque = @saq');

CALL teste('T43', 'RN061', 'Motivo preenchido em registro ainda pendente',
  'bloqueio',
  'UPDATE dados_recebimento SET status_validacao = ''pendente'',
     motivo_rejeicao = ''Titular divergente'' WHERE id_saque = @saq');

CALL teste('T44', 'RN061', 'Rejeição com motivo registrado (deve passar)',
  'aceite',
  'UPDATE dados_recebimento SET status_validacao = ''rejeitado'',
     motivo_rejeicao = ''A chave Pix informada nao pertence ao titular do saque''
   WHERE id_saque = @saq');

-- =====================================================================
-- DENÚNCIA UNIFICADA (RN052, RF050, RF067, RF068)
-- Cobre chk_denuncia_alvo, chk_denuncia_motivo e chk_denuncia_analise.
-- =====================================================================
SET @aval = (SELECT id FROM avaliacao ORDER BY id LIMIT 1);

CALL teste('T45', 'RN052', 'Denúncia de fornecedor apontando também para uma avaliação',
  'bloqueio',
  'INSERT INTO denuncia (tipo_denuncia, id_avaliacao, id_solicitacao, motivo_padrao, motivo)
   VALUES (''fornecedor'', @aval, @sol_a, ''servico_nao_prestado'',
           ''Alvo duplo nao permitido'')');

CALL teste('T46', 'RN052', 'Denúncia de avaliação com motivo exclusivo de fornecedor',
  'bloqueio',
  'INSERT INTO denuncia (tipo_denuncia, id_avaliacao, motivo_padrao, motivo)
   VALUES (''avaliacao'', @aval, ''servico_nao_prestado'', ''Motivo incompativel'')');

CALL teste('T47', 'RN052', 'Denúncia de fornecedor válida (deve passar)',
  'aceite',
  'INSERT INTO denuncia (tipo_denuncia, id_solicitacao, motivo_padrao, motivo)
   VALUES (''fornecedor'', @sol_a, ''servico_nao_prestado'',
           ''O fornecedor nao compareceu ao evento contratado'')');

-- O T47 acima prova que a denúncia é aceita, mas o harness desfaz cada
-- teste: a linha que ele cria não chega ao T48 nem ao T49, que operavam
-- sobre zero linhas. UPDATE sem linha afetada não é erro, então o T48
-- reprovava e o T49 passava sem testar nada. A denúncia que os dois
-- precisam é criada aqui, FORA do harness, como já se faz com o @sol_c
-- mais acima.
SET @tem_denuncia = (SELECT COUNT(*) FROM denuncia WHERE id_solicitacao = @sol_a);
INSERT INTO denuncia (tipo_denuncia, id_solicitacao, motivo_padrao, motivo)
SELECT 'fornecedor', @sol_a, 'servico_nao_prestado',
       'Massa dos testes de restricao T48 e T49'
  FROM DUAL WHERE @tem_denuncia = 0;

CALL teste('T48', 'RN052', 'Denúncia analisada sem resultado e sem justificativa',
  'bloqueio',
  'UPDATE denuncia SET status_denuncia = ''analisada'', data_analise = NOW()
    WHERE id_solicitacao = @sol_a');

CALL teste('T49', 'RN052', 'Denúncia analisada com resultado e justificativa (deve passar)',
  'aceite',
  'UPDATE denuncia SET status_denuncia = ''analisada'', resultado_analise = ''procedente'',
     justificativa_analise = ''Ausencia confirmada pelo historico do chat'',
     data_analise = NOW() WHERE id_solicitacao = @sol_a');

-- =====================================================================
-- CONTESTAÇÃO DA CONCLUSÃO (RN069, RF069, RF070)
-- Cobre chk_solicitacao_contestacao, chk_solicitacao_contestacao_origem
-- e chk_solicitacao_contestacao_pendente.
-- =====================================================================
-- Massa própria: solicitação "confirmada" com conclusão registrada pelo
-- fornecedor e ainda sem confirmação do cliente — a janela da RN039.
INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro)
VALUES ('SP', 'Franca', '14402000', 'Rua dos Testes de Restricao', '11', 'Centro');
SET @end_e = LAST_INSERT_ID();

INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
                         data_hora_evento, duracao, numero_convidados,
                         valor_referencia, valor_final, status,
                         data_limite_resposta_fornecedor,
                         data_resposta_fornecedor,
                         data_registro_conclusao_fornecedor)
VALUES (@cli, @serv, @end_e, @tl, @cob, '2026-01-10 14:00:00', 4.0, 30,
        250.00, 1000.00, 'confirmado', '2026-01-05 12:00:00',
        '2026-01-04 09:00:00', '2026-01-10 20:00:00');
SET @sol_e = LAST_INSERT_ID();

-- Armadilha do NULL: sem o operador null-safe (<=>) em chk_solicitacao_contestacao,
-- o status ausente tornaria o CHECK NULL e a linha passaria.
CALL teste('T50', 'RN069', 'Contestação com motivo e data, porém sem status',
  'bloqueio',
  'UPDATE solicitacao SET motivo_contestacao_cliente = ''servico_nao_prestado'',
     descricao_contestacao_cliente = ''O fornecedor nao compareceu'',
     data_contestacao_cliente = NOW() WHERE id = @sol_e');

CALL teste('T51', 'RN069', 'Contestação ainda pendente já com resultado registrado',
  'bloqueio',
  'UPDATE solicitacao SET motivo_contestacao_cliente = ''servico_nao_prestado'',
     descricao_contestacao_cliente = ''O fornecedor nao compareceu'',
     data_contestacao_cliente = NOW(), status_contestacao = ''pendente'',
     resultado_contestacao = ''procedente'' WHERE id = @sol_e');

CALL teste('T52', 'RN069', 'Contestação em solicitação sem conclusão registrada',
  'bloqueio',
  'UPDATE solicitacao SET motivo_contestacao_cliente = ''servico_nao_prestado'',
     descricao_contestacao_cliente = ''Sem conclusao registrada'',
     data_contestacao_cliente = NOW(), status_contestacao = ''pendente''
   WHERE id = @sol_c');

CALL teste('T53', 'RN069', 'Contestação pendente registrada corretamente (deve passar)',
  'aceite',
  'UPDATE solicitacao SET motivo_contestacao_cliente = ''servico_nao_prestado'',
     descricao_contestacao_cliente = ''O fornecedor nao compareceu ao evento'',
     data_contestacao_cliente = NOW(), status_contestacao = ''pendente''
   WHERE id = @sol_e');

-- Mesma armadilha do T48: o T53 acima prova que a contestação é aceita,
-- mas o harness a desfaz. Sem ela, o T54 confirmava uma conclusão que não
-- tinha contestação nenhuma a barrar, e o T55 tentava analisar uma
-- contestação inexistente — caindo na chk_solicitacao_contestacao, que
-- exige motivo, descrição e data preenchidos. A contestação que os dois
-- precisam é registrada aqui, fora do harness.
UPDATE solicitacao
   SET motivo_contestacao_cliente = 'servico_nao_prestado',
       descricao_contestacao_cliente = 'O fornecedor nao compareceu ao evento',
       data_contestacao_cliente = NOW(),
       status_contestacao = 'pendente'
 WHERE id = @sol_e;

-- Enquanto a contestação estiver pendente, a conclusão não pode ser confirmada:
-- é essa trava que mantém a solicitação fora da elegibilidade do repasse (RN056).
CALL teste('T54', 'RN069', 'Confirmação de conclusão com contestação pendente',
  'bloqueio',
  'UPDATE solicitacao SET data_confirmacao_conclusao_cliente = NOW() WHERE id = @sol_e');

CALL teste('T55', 'RN069', 'Contestação improcedente libera a conclusão (deve passar)',
  'aceite',
  'UPDATE solicitacao SET status_contestacao = ''analisada'',
     resultado_contestacao = ''improcedente'',
     justificativa_contestacao = ''Fotos e chat comprovam a execucao do servico'',
     data_analise_contestacao = NOW(),
     data_confirmacao_conclusao_cliente = NOW(), status = ''concluido''
   WHERE id = @sol_e');

-- ---------------------------------------------------------------------
-- FOTOS DA CONTESTAÇÃO (RN069, RF069-B)
-- Cobre a fk_foto_contestacao_solicitacao e a obrigatoriedade de enviado_por.
-- O envio só durante a pendência e o limite por parte são da aplicação
-- (ver o comentário da tabela no DDL), por isso não têm teste aqui.
-- O @sol_e continua com a contestação pendente: o T55 acima foi desfeito.
--
-- Valor fora do ENUM (um papel inexistente, como 'administrador') não entra
-- no harness: o MySQL o recusa com o erro 1265, de SQLSTATE '01000', que é
-- classe de aviso e escapa do HANDLER FOR SQLEXCEPTION — o roteiro pararia.
-- ---------------------------------------------------------------------
CALL teste('T67', 'RF069-B', 'Foto de contestação para solicitação inexistente',
  'bloqueio',
  'INSERT INTO foto_contestacao (id_solicitacao, enviado_por, imagem_url)
   VALUES (0, ''cliente'', ''/api/fotos-contestacao/teste.jpg'')');

CALL teste('T68', 'RF069-B', 'Foto de contestação sem o papel de quem enviou',
  'bloqueio',
  'INSERT INTO foto_contestacao (id_solicitacao, enviado_por, imagem_url)
   VALUES (@sol_e, NULL, ''/api/fotos-contestacao/teste.jpg'')');

CALL teste('T69', 'RF069-B', 'Foto do fornecedor na contestação pendente (deve passar)',
  'aceite',
  'INSERT INTO foto_contestacao (id_solicitacao, enviado_por, imagem_url)
   VALUES (@sol_e, ''fornecedor'', ''/api/fotos-contestacao/teste.jpg'')');

-- ---------------------------------------------------------------------
-- VERSÃO DO FORNECEDOR (RN069, RF069-B)
-- Cobre a chk_solicitacao_contestacao_fornecedor. O envio único — a
-- versão não se reescreve — é da aplicação: um CHECK compara colunas da
-- mesma linha, não o valor antigo com o novo.
-- O @sol_e continua com a contestação pendente.
-- ---------------------------------------------------------------------
CALL teste('T70', 'RF069-B', 'Versão do fornecedor sem a data do envio',
  'bloqueio',
  'UPDATE solicitacao SET descricao_contestacao_fornecedor = ''Montei a estrutura completa no horario''
   WHERE id = @sol_e');

CALL teste('T71', 'RF069-B', 'Versão do fornecedor em solicitação sem contestação',
  'bloqueio',
  'UPDATE solicitacao SET descricao_contestacao_fornecedor = ''Montei a estrutura completa no horario'',
     data_contestacao_fornecedor = NOW()
   WHERE id = @sol_c');

CALL teste('T72', 'RF069-B', 'Versão do fornecedor anterior à contestação',
  'bloqueio',
  'UPDATE solicitacao SET descricao_contestacao_fornecedor = ''Montei a estrutura completa no horario'',
     data_contestacao_fornecedor = data_contestacao_cliente - INTERVAL 1 HOUR
   WHERE id = @sol_e');

CALL teste('T73', 'RF069-B', 'Versão do fornecedor posterior à decisão',
  'bloqueio',
  'UPDATE solicitacao SET status_contestacao = ''analisada'',
     resultado_contestacao = ''improcedente'',
     justificativa_contestacao = ''Fotos e chat comprovam a execucao do servico'',
     data_analise_contestacao = NOW(),
     data_confirmacao_conclusao_cliente = NOW(), status = ''concluido'',
     descricao_contestacao_fornecedor = ''Montei a estrutura completa no horario'',
     data_contestacao_fornecedor = NOW() + INTERVAL 1 HOUR
   WHERE id = @sol_e');

CALL teste('T74', 'RF069-B', 'Versão do fornecedor na contestação pendente (deve passar)',
  'aceite',
  'UPDATE solicitacao SET descricao_contestacao_fornecedor = ''Montei a estrutura completa no horario'',
     data_contestacao_fornecedor = NOW()
   WHERE id = @sol_e');

-- =====================================================================
-- ARMADILHA DO NULL EM COLUNAS ANULÁVEIS E INTEGRIDADE DO PAGAMENTO PAGO
-- Cobre chk_pagamento_cartao (corrigido), chk_pagamento_pago e
-- chk_notificacao_referencia. Com chk_usuario_geo corrigido, o T37 volta
-- a reprovar de verdade a coordenada pela metade.
-- =====================================================================
CALL teste('T56', 'RN018', 'Cartão vinculado sem forma de pagamento escolhida',
  'bloqueio',
  'INSERT INTO pagamento (id_solicitacao, valor_bruto, percentual_comissao,
     valor_comissao, valor_repassado, perc_multa_faixa_mais_7d, perc_multa_faixa_7d_48h,
     perc_multa_faixa_48h_24h, perc_multa_faixa_24h, id_cartao_credito, data_limite)
   VALUES (@sol_c, 1000.00, 10.00, 100.00, 900.00, 0.00, 25.00, 50.00, 100.00,
           @cartao, NOW() + INTERVAL 24 HOUR)');

CALL teste('T57', 'RF058', 'Pagamento "pago" sem identificador da transação',
  'bloqueio',
  'UPDATE pagamento SET id_transacao_gateway = NULL WHERE id = @pag_a');

CALL teste('T58', 'RF064', 'Notificação de conta com referência de solicitação',
  'bloqueio',
  'INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem, id_solicitacao)
   VALUES (@u_cli, ''conta'', ''Conta suspensa'', ''Sua conta foi suspensa.'', @sol_a)');

CALL teste('T59', 'RF064', 'Notificação de pagamento com referência (deve passar)',
  'aceite',
  'INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem, id_solicitacao)
   VALUES (@u_cli, ''pagamento'', ''Pagamento confirmado'', ''Recebemos seu pagamento.'', @sol_a)');

-- RF026/RN065: o aviso de mensagem nova é vinculado à solicitação do chat,
-- portanto pertence ao grupo de tipos que exige a referência.
CALL teste('T63', 'RF064', 'Notificação de mensagem sem referência de solicitação',
  'bloqueio',
  'INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem)
   VALUES (@u_cli, ''mensagem'', ''Nova mensagem'', ''Ana enviou uma mensagem.'')');

CALL teste('T64', 'RF026', 'Notificação de mensagem com referência (deve passar)',
  'aceite',
  'INSERT INTO notificacao (id_usuario, tipo, titulo, mensagem, id_solicitacao)
   VALUES (@u_cli, ''mensagem'', ''Nova mensagem'',
           ''Ana enviou uma mensagem sobre Buffet Festa Boa.'', @sol_a)');

-- =====================================================================
-- TIPO DE COBRANÇA CONGELADO NO ENVIO (RN029, RF027, RF058)
-- Cobre a coluna solicitacao.id_cobranca e a fk_solicitacao_cobranca.
-- =====================================================================
INSERT INTO endereco (estado, cidade, cep, rua, numero, bairro)
VALUES ('SP', 'Franca', '14402000', 'Rua dos Testes de Restricao', '12', 'Centro');
SET @end_f = LAST_INSERT_ID();

CALL teste('T65', 'RN029', 'Solicitação sem o tipo de cobrança vigente no envio',
  'bloqueio',
  'INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
     data_hora_evento, duracao, numero_convidados, valor_referencia, valor_final,
     data_limite_resposta_fornecedor)
   VALUES (@cli, @serv, @end_f, @tl, NULL, ''2027-08-01 10:00:00'', 4.0, 30,
           250.00, 1000.00, NOW() + INTERVAL 48 HOUR)');

CALL teste('T66', 'RN029', 'Solicitação com tipo de cobrança inexistente',
  'bloqueio',
  'INSERT INTO solicitacao (id_cliente, id_servico, id_endereco, id_tipo_local, id_cobranca,
     data_hora_evento, duracao, numero_convidados, valor_referencia, valor_final,
     data_limite_resposta_fornecedor)
   VALUES (@cli, @serv, @end_f, @tl, 99, ''2027-08-01 10:00:00'', 4.0, 30,
           250.00, 1000.00, NOW() + INTERVAL 48 HOUR)');

-- =====================================================================
-- RELATÓRIO
-- =====================================================================
SELECT teste, regra, situacao, esperado, obtido, veredito FROM _resultado ORDER BY seq;

SELECT COUNT(*) AS total,
       SUM(veredito = 'OK')    AS aprovados,
       SUM(veredito = 'FALHA') AS reprovados
  FROM _resultado;

SELECT teste, regra, situacao, detalhe AS motivo_da_falha
  FROM _resultado WHERE veredito = 'FALHA' ORDER BY seq;

-- Devolve a conexão ao estado em que estava.
SET SQL_SAFE_UPDATES = @modo_seguro_anterior;
