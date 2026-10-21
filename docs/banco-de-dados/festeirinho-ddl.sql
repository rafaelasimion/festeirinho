-- =====================================================================
-- FESTEIRINHO — Modelo Físico (DDL)
-- SGBD alvo: MySQL 8.0.16+ (CHECK constraints são obrigatórios)
-- Engine: InnoDB | Charset: utf8mb4
--
-- Convenções:
--   tabelas e colunas em snake_case, sem acento, no singular
--   PK sempre "id"; FK sempre "id_<tabela_referenciada>"
--   valores monetários: DECIMAL(10,2) | percentuais: DECIMAL(5,2)
--   todas as FKs usam ON DELETE RESTRICT ON UPDATE RESTRICT (RN044-C).
--   ON UPDATE CASCADE foi descartado: as PKs são surrogate AUTO_INCREMENT e
--   nunca mudam, e o MySQL proíbe usar em CHECK qualquer coluna que participe
--   de uma FK com ação referencial (erro 3823) — o que inviabilizaria os
--   CHECKs de chk_cliente_tipo, chk_fornecedor_tipo e chk_favorito_xor.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS festeirinho
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE festeirinho;

-- =====================================================================
-- 1. IDENTIDADE E PAPÉIS
-- =====================================================================

-- RN055: um usuário assume exatamente um papel. A UNIQUE (id, tipo_usuario)
-- existe para servir de alvo da FK composta em cliente/fornecedor, tornando
-- a regra declarativa em vez de validada pela aplicação.
--
-- RN044-A: senha_hash é obrigatória enquanto a conta existe e só fica NULL
-- na exclusão, porque o hash é uma credencial e não deve sobreviver à
-- conta. Quem garante o preenchimento é o cadastro, na aplicação: o status
-- que diz se a conta foi excluída fica em cliente ou fornecedor, e um CHECK
-- não alcança outra tabela. Sem hash, o login trata a conta como senha que
-- não confere.
CREATE TABLE usuario (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo_usuario       ENUM('cliente','fornecedor') NOT NULL,
  nome               VARCHAR(150)  NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  nome_usuario       VARCHAR(50)   NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  email              VARCHAR(255)  NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  telefone           VARCHAR(20)   NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  senha_hash         CHAR(60)      NULL COMMENT 'bcrypt; nunca em texto puro; NULL após exclusão de conta (RN044-A)',
  estado             CHAR(2)       NOT NULL,
  cidade             VARCHAR(100)  NOT NULL,
  foto_perfil        VARCHAR(500)  NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  latitude           DECIMAL(9,6)  NULL COMMENT 'capturada do dispositivo (RN068); NULL após exclusão de conta (RN044-A)',
  longitude          DECIMAL(9,6)  NULL COMMENT 'par com latitude: ambas preenchidas ou ambas nulas',
  data_cadastro      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_ultimo_login  DATETIME      NULL COMMENT 'base para inativação automática (RN043, RN047)',
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuario_nome_usuario (nome_usuario),
  UNIQUE KEY uk_usuario_email (email),
  UNIQUE KEY uk_usuario_id_tipo (id, tipo_usuario),
  -- RN068: a coordenada é opcional (o usuário pode não autorizar a captura), mas
  -- nunca pela metade. O par totalmente nulo cobre tanto essa recusa quanto a
  -- anonimização da RN044-A, por isso o CHECK aceita esse caso explicitamente.
  KEY ix_usuario_geo (latitude, longitude),
  CONSTRAINT chk_usuario_geo CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude  BETWEEN  -90 AND  90
        AND longitude BETWEEN -180 AND 180))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RF071: acesso administrativo, separado das contas de usuário.
-- O administrador não possui papel de cliente nem de fornecedor (RN055) e não
-- participa dos fluxos de contratação, por isso não é registrado em usuario:
-- não tem CPF, endereço, localização, favoritos nem avaliações. Esta versão
-- não registra a autoria individual das ações administrativas.
-- ---------------------------------------------------------------------
CREATE TABLE administrador (
  id                    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome                  VARCHAR(150)  NOT NULL,
  email                 VARCHAR(255)  NOT NULL,
  senha_hash            CHAR(60)      NOT NULL COMMENT 'bcrypt; nunca em texto puro (RNF001)',
  status_administrador  ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  data_cadastro         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_ultimo_login     DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_administrador_email (email)
) ENGINE=InnoDB;

CREATE TABLE cliente (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario                  BIGINT UNSIGNED NOT NULL,
  tipo_usuario                ENUM('cliente','fornecedor') NOT NULL DEFAULT 'cliente',
  cpf                         CHAR(11)      NULL COMMENT 'só dígitos; NULL após exclusão (RN044-A)',
  data_nascimento             DATE          NULL COMMENT 'NULL após exclusão (RN044-A)',
  status_cliente              ENUM('ativo','suspenso','inativo','excluido') NOT NULL DEFAULT 'ativo',
  motivo_suspensao            VARCHAR(500)  NULL,
  data_suspensao              DATETIME      NULL,
  motivo_solicitacao_revisao  VARCHAR(1000) NULL COMMENT 'sobrescrito a cada novo envio; sem histórico; NULL após exclusão (RN044-A)',
  data_solicitacao_revisao    DATETIME      NULL,
  status_solicitacao_revisao  ENUM('pendente','analisada') NULL,
  resultado_solicitacao_revisao VARCHAR(1000) NULL COMMENT 'texto devolvido pela administração (RF059); exibido na tela de bloqueio (UC 003, 6a.4)',
  data_analise_revisao        DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cliente_usuario (id_usuario),
  UNIQUE KEY uk_cliente_cpf (cpf),
  CONSTRAINT chk_cliente_tipo CHECK (tipo_usuario = 'cliente'),
  CONSTRAINT chk_cliente_suspensao CHECK (
    (status_cliente = 'suspenso' AND motivo_suspensao IS NOT NULL AND data_suspensao IS NOT NULL)
    OR status_cliente <> 'suspenso'),
  -- RF006/RF059: os campos de revisão só admitem três estados coerentes —
  -- inexistente, pendente e analisada. Não se exige aqui que a conta esteja
  -- suspensa: a revisão aprovada devolve a conta a 'ativo' mantendo o registro.
  CONSTRAINT chk_cliente_revisao CHECK (
    (status_solicitacao_revisao IS NULL
      AND motivo_solicitacao_revisao IS NULL AND data_solicitacao_revisao IS NULL
      AND resultado_solicitacao_revisao IS NULL AND data_analise_revisao IS NULL)
    OR (status_solicitacao_revisao <=> 'pendente'
      AND motivo_solicitacao_revisao IS NOT NULL AND data_solicitacao_revisao IS NOT NULL
      AND resultado_solicitacao_revisao IS NULL AND data_analise_revisao IS NULL)
    OR (status_solicitacao_revisao <=> 'analisada'
      AND motivo_solicitacao_revisao IS NOT NULL AND data_solicitacao_revisao IS NOT NULL
      AND resultado_solicitacao_revisao IS NOT NULL AND data_analise_revisao IS NOT NULL)),
  CONSTRAINT fk_cliente_usuario FOREIGN KEY (id_usuario, tipo_usuario)
    REFERENCES usuario (id, tipo_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE fornecedor (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario                  BIGINT UNSIGNED NOT NULL,
  tipo_usuario                ENUM('cliente','fornecedor') NOT NULL DEFAULT 'fornecedor',
  tipo_pessoa                 ENUM('PF','PJ') NOT NULL COMMENT 'imutável após o cadastro (RF004)',
  cpf                         CHAR(11)      NULL,
  cnpj                        CHAR(14)      NULL,
  razao_social                VARCHAR(200)  NULL,
  data_nascimento             DATE          NULL
                                COMMENT 'apenas PF; NULL para PJ (RN001); idade mínima validada na aplicação (RF002)',
  nome_exibicao               VARCHAR(150)  NOT NULL COMMENT 'rótulo genérico após exclusão (RN044-A)',
  descricao                   TEXT          NOT NULL,
  instagram_url               VARCHAR(500)  NULL,
  whatsapp_url                VARCHAR(500)  NULL,
  site                        VARCHAR(500)  NULL,
  raio_atendimento_km         SMALLINT UNSIGNED NOT NULL DEFAULT 30
                                COMMENT 'alcance a partir da sede, em km (RN068); padrão parametrizável (RN014)',
  status_fornecedor           ENUM('ativo','pausado','suspenso','inativo','excluido') NOT NULL DEFAULT 'ativo',
  status_verificacao          ENUM('pendente','aprovado','rejeitado') NOT NULL DEFAULT 'pendente'
                                COMMENT 'volta a pendente quando dados relevantes da vitrine mudam (RN067)',
  motivo_rejeicao             VARCHAR(500)  NULL,
  data_verificacao            DATETIME      NULL,
  motivo_suspensao            VARCHAR(500)  NULL,
  data_suspensao              DATETIME      NULL,
  motivo_solicitacao_revisao  VARCHAR(1000) NULL COMMENT 'sobrescrito a cada novo envio; sem histórico; NULL após exclusão (RN044-A)',
  data_solicitacao_revisao    DATETIME      NULL,
  status_solicitacao_revisao  ENUM('pendente','analisada') NULL,
  resultado_solicitacao_revisao VARCHAR(1000) NULL COMMENT 'texto devolvido pela administração (RF059); exibido na tela de bloqueio (UC 003, 6a.4)',
  data_analise_revisao        DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_fornecedor_usuario (id_usuario),
  UNIQUE KEY uk_fornecedor_cpf (cpf),
  UNIQUE KEY uk_fornecedor_cnpj (cnpj),
  CONSTRAINT chk_fornecedor_tipo CHECK (tipo_usuario = 'fornecedor'),
  -- RN001: exclusividade PF/PJ. Verifica apenas o lado "deve ser NULL", para
  -- não colidir com a anonimização da RN044-A, que zera cpf/cnpj/razao_social.
  -- A obrigatoriedade do lado preenchido é validada na aplicação, no cadastro.
  CONSTRAINT chk_fornecedor_pf_pj CHECK (
    (tipo_pessoa = 'PF' AND cnpj IS NULL AND razao_social IS NULL)
    OR (tipo_pessoa = 'PJ' AND cpf IS NULL)),
  -- RF002: capacidade civil para contratar e receber valores pela plataforma.
  -- Acompanha a exclusividade PF/PJ da RN001 — pessoa jurídica não tem data de
  -- nascimento. Como em chk_fornecedor_pf_pj, verifica apenas o lado "deve ser
  -- NULL", para não colidir com a anonimização da RN044-A, que zera a data de
  -- nascimento na exclusão da conta. A obrigatoriedade do preenchimento para PF
  -- é validada na aplicação, no cadastro.
  CONSTRAINT chk_fornecedor_nascimento CHECK (
    tipo_pessoa = 'PF' OR data_nascimento IS NULL),
  CONSTRAINT chk_fornecedor_rejeicao CHECK (
    (status_verificacao = 'rejeitado' AND motivo_rejeicao IS NOT NULL)
    OR status_verificacao <> 'rejeitado'),
  -- RN068: faixa defensiva do raio declarado. O valor de fato ofertado como padrão
  -- vem da configuração (raio_atendimento_padrao_km), não deste limite.
  CONSTRAINT chk_fornecedor_raio CHECK (raio_atendimento_km BETWEEN 1 AND 200),
  -- RN054: suspensão do fornecedor é análoga à do cliente (RN038) e exige,
  -- do mesmo modo, motivo e data registrados. Espelha chk_cliente_suspensao.
  CONSTRAINT chk_fornecedor_suspensao CHECK (
    (status_fornecedor = 'suspenso' AND motivo_suspensao IS NOT NULL AND data_suspensao IS NOT NULL)
    OR status_fornecedor <> 'suspenso'),
  -- RF006-B/RF059: espelha chk_cliente_revisao.
  CONSTRAINT chk_fornecedor_revisao CHECK (
    (status_solicitacao_revisao IS NULL
      AND motivo_solicitacao_revisao IS NULL AND data_solicitacao_revisao IS NULL
      AND resultado_solicitacao_revisao IS NULL AND data_analise_revisao IS NULL)
    OR (status_solicitacao_revisao <=> 'pendente'
      AND motivo_solicitacao_revisao IS NOT NULL AND data_solicitacao_revisao IS NOT NULL
      AND resultado_solicitacao_revisao IS NULL AND data_analise_revisao IS NULL)
    OR (status_solicitacao_revisao <=> 'analisada'
      AND motivo_solicitacao_revisao IS NOT NULL AND data_solicitacao_revisao IS NOT NULL
      AND resultado_solicitacao_revisao IS NOT NULL AND data_analise_revisao IS NOT NULL)),
  CONSTRAINT fk_fornecedor_usuario FOREIGN KEY (id_usuario, tipo_usuario)
    REFERENCES usuario (id, tipo_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 2. DOMÍNIOS FECHADOS (tabelas de apoio)
-- =====================================================================

CREATE TABLE categoria (
  id    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome  VARCHAR(80) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_categoria_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE cobranca (
  id         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  descricao  ENUM('hora','pessoa','fixo') NOT NULL COMMENT 'define a fórmula do valor final (RN029)',
  PRIMARY KEY (id),
  UNIQUE KEY uk_cobranca_descricao (descricao)
) ENGINE=InnoDB;

CREATE TABLE tipo_local (
  id         TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  descricao  VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tipo_local_descricao (descricao)
) ENGINE=InnoDB;

-- =====================================================================
-- 3. CATÁLOGO DE SERVIÇOS
-- =====================================================================

CREATE TABLE servico (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_fornecedor       BIGINT UNSIGNED NOT NULL,
  id_categoria        SMALLINT UNSIGNED NOT NULL,
  id_cobranca         TINYINT UNSIGNED NOT NULL COMMENT 'copiado para solicitacao.id_cobranca no envio (RN029)',
  nome                VARCHAR(150)  NOT NULL,
  descricao           TEXT          NOT NULL,
  preco_base          DECIMAL(10,2) NOT NULL COMMENT 'copiado para solicitacao.valor_referencia no envio (RN029)',
  capacidade_max      INT UNSIGNED  NULL COMMENT 'NULL = sem limite (RN017)',
  dias_antecedencia   SMALLINT UNSIGNED NOT NULL COMMENT 'piso calculado pela RN046, validado na aplicação',
  status_servico      ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  status_verificacao  ENUM('pendente','aprovado','rejeitado') NOT NULL DEFAULT 'pendente'
                        COMMENT 'volta a pendente quando campo relevante do serviço muda (RN067)',
  motivo_rejeicao     VARCHAR(500)  NULL,
  data_cadastro       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_servico_vitrine (status_servico, status_verificacao, id_categoria),
  CONSTRAINT chk_servico_preco CHECK (preco_base > 0),
  CONSTRAINT chk_servico_capacidade CHECK (capacidade_max IS NULL OR capacidade_max > 0),
  CONSTRAINT chk_servico_antecedencia CHECK (dias_antecedencia >= 1),
  CONSTRAINT chk_servico_rejeicao CHECK (
    (status_verificacao = 'rejeitado' AND motivo_rejeicao IS NOT NULL)
    OR status_verificacao <> 'rejeitado'),
  CONSTRAINT fk_servico_fornecedor FOREIGN KEY (id_fornecedor)
    REFERENCES fornecedor (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_servico_categoria FOREIGN KEY (id_categoria)
    REFERENCES categoria (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_servico_cobranca FOREIGN KEY (id_cobranca)
    REFERENCES cobranca (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- RF012: no máximo uma foto principal por serviço.
-- MySQL não tem índice único parcial; a coluna gerada converte FALSE em NULL,
-- e como o índice único aceita múltiplos NULL, só um TRUE sobrevive por serviço.
CREATE TABLE foto_servico (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_servico    BIGINT UNSIGNED NOT NULL,
  imagem_url    VARCHAR(500) NOT NULL,
  principal     BOOLEAN NOT NULL DEFAULT FALSE,
  principal_uk  TINYINT UNSIGNED GENERATED ALWAYS AS (IF(principal, 1, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_foto_principal (id_servico, principal_uk),
  CONSTRAINT fk_foto_servico FOREIGN KEY (id_servico)
    REFERENCES servico (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE favorito (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente     BIGINT UNSIGNED NOT NULL,
  tipo_favorito  ENUM('servico','fornecedor') NOT NULL,
  id_servico     BIGINT UNSIGNED NULL,
  id_fornecedor  BIGINT UNSIGNED NULL,
  data_salvo     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- RN004: múltiplos NULL são aceitos em índice único no MySQL, então cada
  -- chave restringe duplicidade apenas dentro do seu próprio tipo de favorito.
  UNIQUE KEY uk_favorito_servico (id_cliente, id_servico),
  UNIQUE KEY uk_favorito_fornecedor (id_cliente, id_fornecedor),
  CONSTRAINT chk_favorito_xor CHECK (          -- RN003
    (tipo_favorito = 'servico'    AND id_servico IS NOT NULL AND id_fornecedor IS NULL)
    OR (tipo_favorito = 'fornecedor' AND id_fornecedor IS NOT NULL AND id_servico IS NULL)),
  CONSTRAINT fk_favorito_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_favorito_servico FOREIGN KEY (id_servico)
    REFERENCES servico (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_favorito_fornecedor FOREIGN KEY (id_fornecedor)
    REFERENCES fornecedor (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 4. CONTRATAÇÃO
-- =====================================================================

-- RN009: endereço exclusivo por solicitação, garantido pela UNIQUE em
-- solicitacao.id_endereco (nenhum endereço é reaproveitado).
CREATE TABLE endereco (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  estado       CHAR(2)      NOT NULL,
  cidade       VARCHAR(100) NOT NULL,
  cep          CHAR(8)      NOT NULL,
  rua          VARCHAR(200) NOT NULL,
  numero       VARCHAR(20)  NOT NULL,
  bairro       VARCHAR(100) NOT NULL,
  complemento  VARCHAR(100) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE solicitacao (
  id                                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente                          BIGINT UNSIGNED NOT NULL,
  id_servico                          BIGINT UNSIGNED NOT NULL,
  id_endereco                         BIGINT UNSIGNED NOT NULL,
  id_tipo_local                       TINYINT UNSIGNED NOT NULL,
  -- RN029/RF027: o tipo de cobrança vigente no envio, congelado como o
  -- preço (valor_referencia). Sem ele, o comprovante (RF058) lia a cobrança
  -- ATUAL do serviço: um serviço trocado de "hora" para "pessoa" fazia uma
  -- contratação antiga aparecer como cobrada por pessoa, com o valor final
  -- calculado por hora. A FK aponta para o domínio fechado da tabela
  -- cobranca, cujas linhas nunca mudam, e por isso basta como retrato.
  id_cobranca                         TINYINT UNSIGNED NOT NULL
                                        COMMENT 'snapshot de servico.id_cobranca no envio (RN029)',
  data_hora_evento                    DATETIME      NOT NULL COMMENT 'imutável após o envio (RF024, RN042)',
  duracao                             DECIMAL(4,1)  NOT NULL COMMENT 'em horas; aceita fração (ex.: 2.5)',
  numero_convidados                   INT UNSIGNED  NOT NULL COMMENT 'obrigatório sempre (RF017)',
  tema                                VARCHAR(100)  NULL,
  nome_aniversariante                 VARCHAR(150)  NULL,
  idade_aniversariante                TINYINT UNSIGNED NULL,
  observacoes                         TEXT          NULL,
  valor_referencia                    DECIMAL(10,2) NOT NULL COMMENT 'snapshot do preco_base no envio (RN029)',
  valor_final                         DECIMAL(10,2) NOT NULL COMMENT 'calculado e gravado no envio (RF027)',
  data_solicitacao                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status                              ENUM('aguardando_analise','aguardando_pagamento','confirmado',
                                           'concluido','recusado','cancelado','expirado')
                                      NOT NULL DEFAULT 'aguardando_analise',
  motivo_recusa                       ENUM('agenda_indisponivel','fora_da_area','inviabilidade','outro') NULL,
  data_limite_resposta_fornecedor     DATETIME      NOT NULL COMMENT 'RN035',
  data_resposta_fornecedor            DATETIME      NULL COMMENT 'aprovação, recusa ou expiração (RF023)',
  data_registro_conclusao_fornecedor  DATETIME      NULL,
  data_confirmacao_conclusao_cliente  DATETIME      NULL COMMENT 'marco da carência do repasse (RN056)',
  -- RF069/RN069: contestação da conclusão pelo cliente. Espelha o padrão de
  -- análise administrativa já usado em cliente/fornecedor (chk_cliente_revisao).
  motivo_contestacao_cliente          ENUM('servico_nao_prestado','servico_parcial',
                                           'servico_divergente') NULL,
  descricao_contestacao_cliente       VARCHAR(1000) NULL,
  data_contestacao_cliente            DATETIME      NULL,
  -- RF069-B/RN069: a versão do fornecedor sobre a contestação — envio único,
  -- opcional e sem prazo, visível só à administração. Fica registrada depois
  -- da decisão, como a descrição do cliente; as imagens, não (foto_contestacao).
  descricao_contestacao_fornecedor    VARCHAR(1000) NULL,
  data_contestacao_fornecedor         DATETIME      NULL,
  status_contestacao                 ENUM('pendente','analisada') NULL,
  resultado_contestacao               ENUM('procedente','improcedente') NULL,
  justificativa_contestacao           VARCHAR(1000) NULL COMMENT 'texto devolvido pela administração (RF070)',
  data_analise_contestacao            DATETIME      NULL,
  -- RN036/RF022: bloqueia duplicidade apenas entre solicitações ativas.
  -- Em status terminal a coluna gerada vira NULL e o índice deixa de restringir.
  chave_duplicidade                   CHAR(1) GENERATED ALWAYS AS (
                                        IF(status IN ('aguardando_analise','aguardando_pagamento','confirmado'),
                                           'A', NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_solicitacao_endereco (id_endereco),
  UNIQUE KEY uk_solicitacao_ativa (id_cliente, id_servico, data_hora_evento, chave_duplicidade),
  KEY ix_solicitacao_cliente (id_cliente, status),
  KEY ix_solicitacao_servico (id_servico, status),
  KEY ix_solicitacao_expiracao (status, data_limite_resposta_fornecedor),
  KEY ix_solicitacao_conclusao (status, data_hora_evento),
  KEY ix_solicitacao_contestacao (status_contestacao, data_contestacao_cliente),
  CONSTRAINT chk_solicitacao_duracao CHECK (duracao > 0),
  CONSTRAINT chk_solicitacao_convidados CHECK (numero_convidados > 0),
  CONSTRAINT chk_solicitacao_valores CHECK (valor_final > 0 AND valor_referencia > 0),
  CONSTRAINT chk_solicitacao_recusa CHECK (   -- RN021
    (status = 'recusado' AND motivo_recusa IS NOT NULL)
    OR (status <> 'recusado' AND motivo_recusa IS NULL)),
  CONSTRAINT chk_solicitacao_conclusao CHECK ( -- RN028: cliente só confirma após o fornecedor registrar
    data_confirmacao_conclusao_cliente IS NULL
    OR data_registro_conclusao_fornecedor IS NOT NULL),
  -- RF069/RN069: os campos de contestação só admitem três estados coerentes —
  -- inexistente, pendente e analisada. Uso do operador null-safe (<=>) porque
  -- status_contestacao é anulável: com '=' o NULL satisfaria o CHECK.
  CONSTRAINT chk_solicitacao_contestacao CHECK (
    (status_contestacao IS NULL
      AND motivo_contestacao_cliente IS NULL AND descricao_contestacao_cliente IS NULL
      AND data_contestacao_cliente IS NULL AND resultado_contestacao IS NULL
      AND justificativa_contestacao IS NULL AND data_analise_contestacao IS NULL)
    OR (status_contestacao <=> 'pendente'
      AND motivo_contestacao_cliente IS NOT NULL AND descricao_contestacao_cliente IS NOT NULL
      AND data_contestacao_cliente IS NOT NULL AND resultado_contestacao IS NULL
      AND justificativa_contestacao IS NULL AND data_analise_contestacao IS NULL)
    OR (status_contestacao <=> 'analisada'
      AND motivo_contestacao_cliente IS NOT NULL AND descricao_contestacao_cliente IS NOT NULL
      AND data_contestacao_cliente IS NOT NULL AND resultado_contestacao IS NOT NULL
      AND justificativa_contestacao IS NOT NULL AND data_analise_contestacao IS NOT NULL)),
  -- RN069: só se contesta uma conclusão que o fornecedor tenha registrado (RN028)
  CONSTRAINT chk_solicitacao_contestacao_origem CHECK (
    data_contestacao_cliente IS NULL
    OR data_registro_conclusao_fornecedor IS NOT NULL),
  -- RN069: enquanto pendente, a conclusão não pode estar confirmada — é o que
  -- mantém a solicitação fora da elegibilidade do repasse (RN056, RF054)
  CONSTRAINT chk_solicitacao_contestacao_pendente CHECK (
    NOT (status_contestacao <=> 'pendente')
    OR data_confirmacao_conclusao_cliente IS NULL),
  -- RF069-B/RN069: a versão do fornecedor só existe sobre uma contestação
  -- registrada, com descrição e data sempre juntas, enviada depois da
  -- contestação e antes da decisão. Dentro do segundo ramo as comparações são
  -- entre valores preenchidos, exceto a data da análise, tratada à parte: com
  -- ela NULL, a comparação daria NULL e o CHECK passaria sem conferir nada.
  CONSTRAINT chk_solicitacao_contestacao_fornecedor CHECK (
    (descricao_contestacao_fornecedor IS NULL AND data_contestacao_fornecedor IS NULL)
    OR (descricao_contestacao_fornecedor IS NOT NULL
      AND data_contestacao_fornecedor IS NOT NULL
      AND data_contestacao_cliente IS NOT NULL
      AND data_contestacao_fornecedor >= data_contestacao_cliente
      AND (data_analise_contestacao IS NULL
        OR data_contestacao_fornecedor <= data_analise_contestacao))),
  CONSTRAINT fk_solicitacao_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitacao_servico FOREIGN KEY (id_servico)
    REFERENCES servico (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitacao_endereco FOREIGN KEY (id_endereco)
    REFERENCES endereco (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitacao_tipo_local FOREIGN KEY (id_tipo_local)
    REFERENCES tipo_local (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_solicitacao_cobranca FOREIGN KEY (id_cobranca)
    REFERENCES cobranca (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE mensagem (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao  BIGINT UNSIGNED NOT NULL,
  id_usuario      BIGINT UNSIGNED NOT NULL COMMENT 'remetente; deve ser parte da solicitação (RN019, aplicação)',
  conteudo        TEXT     NOT NULL,
  data_hora       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lida            BOOLEAN  NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY ix_mensagem_conversa (id_solicitacao, data_hora),
  CONSTRAINT fk_mensagem_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_mensagem_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RF069-B/RN069: imagens anexadas à contestação da conclusão, pelo cliente
-- ou pelo fornecedor, para a análise da administração (RF070).
--
-- A tabela só guarda prova de contestação PENDENTE: decidida a contestação,
-- as linhas e os arquivos são apagados na mesma transação que grava a
-- decisão. Foto de festa infantil retrata criança, e a finalidade do dado
-- termina com a decisão (LGPD, art. 6º, III, e art. 14).
--
-- Quem enviou é guardado pelo papel, e não pelo usuário: o usuário é
-- derivável da solicitação (o cliente dela ou o fornecedor do serviço), e
-- guardá-lo criaria um invariante que o SGBD não consegue impor — o mesmo
-- motivo de a denúncia não guardar o fornecedor (RN052).
--
-- Cada parte envia as imagens uma única vez, junto com o seu relato: o
-- cliente no registro da contestação, o fornecedor na sua versão
-- (solicitacao.descricao_contestacao_fornecedor). Depois disso, nada se
-- inclui nem se remove. Isso e o limite de imagens por parte são regras da
-- aplicação: dependem do estado de outra tabela e de uma contagem, o que um
-- CHECK não alcança (como a RN019 no chat).
-- ---------------------------------------------------------------------
CREATE TABLE foto_contestacao (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao  BIGINT UNSIGNED NOT NULL,
  enviado_por     ENUM('cliente','fornecedor') NOT NULL,
  imagem_url      VARCHAR(500) NOT NULL COMMENT 'rota protegida; nunca a rota pública de imagens',
  data_envio      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_foto_contestacao_solicitacao (id_solicitacao, enviado_por),
  CONSTRAINT fk_foto_contestacao_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 5. PAGAMENTO
-- =====================================================================

CREATE TABLE cartao_credito (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente          BIGINT UNSIGNED NOT NULL,
  token_gateway       VARCHAR(255) NOT NULL COMMENT 'RN013: nenhum dado sensível do cartão é persistido',
  ultimos_quatro_num  CHAR(4)      NOT NULL,
  bandeira            VARCHAR(30)  NOT NULL,
  apelido             VARCHAR(50)  NULL,
  status              ENUM('ativo','removido') NOT NULL DEFAULT 'ativo'
                        COMMENT 'remoção é lógica, preservando o histórico (UC 029)',
  PRIMARY KEY (id),
  UNIQUE KEY uk_cartao_token (token_gateway),
  KEY ix_cartao_cliente (id_cliente, status),
  CONSTRAINT fk_cartao_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE pagamento (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao        BIGINT UNSIGNED NOT NULL,
  valor_bruto           DECIMAL(10,2) NOT NULL COMMENT '= solicitacao.valor_final, sem acréscimo (RN027)',
  percentual_comissao   DECIMAL(5,2)  NOT NULL COMMENT 'snapshot da configuração na geração (RN027)',
  valor_comissao        DECIMAL(10,2) NOT NULL,
  valor_repassado       DECIMAL(10,2) NOT NULL,
  perc_multa_faixa_mais_7d  DECIMAL(5,2) NOT NULL
                          COMMENT 'snapshot das faixas da RN050 na geração, como o percentual de comissão (RN027)',
  perc_multa_faixa_7d_48h   DECIMAL(5,2) NOT NULL,
  perc_multa_faixa_48h_24h  DECIMAL(5,2) NOT NULL,
  perc_multa_faixa_24h      DECIMAL(5,2) NOT NULL,
  forma_pagamento       ENUM('pix','cartao','boleto') NULL COMMENT 'NULL até a escolha do cliente',
  id_cartao_credito     BIGINT UNSIGNED NULL,
  status                ENUM('pendente','processando','pago','recusado',
                             'expirado','cancelado','estornado') NOT NULL DEFAULT 'pendente',
  id_transacao_gateway  VARCHAR(100)  NULL,
  data_geracao          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_limite           DATETIME      NOT NULL COMMENT 'regravada a cada escolha/tentativa (RN024)',
  data_pagamento        DATETIME      NULL COMMENT 'preenchida pelo webhook do gateway (RF047)',
  numero_tentativas     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  categoria_falha       ENUM('recusa','erro_tecnico') NULL,
  status_repasse        ENUM('pendente','liberado','cancelado') NOT NULL DEFAULT 'pendente',
  data_repasse          DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pagamento_solicitacao (id_solicitacao),
  UNIQUE KEY uk_pagamento_transacao (id_transacao_gateway),
  KEY ix_pagamento_expiracao (status, data_limite),
  KEY ix_pagamento_repasse (status_repasse, status),
  CONSTRAINT chk_pagamento_comissao CHECK (   -- RN027
    percentual_comissao BETWEEN 0 AND 100
    AND valor_repassado = valor_bruto - valor_comissao),
  -- RN050/RF058: as faixas ficam congeladas no pagamento, como o percentual de
  -- comissão (RN027), para que o comprovante (UC 034) e o cálculo do cancelamento
  -- reproduzam as condições vigentes na contratação.
  CONSTRAINT chk_pagamento_faixas CHECK (
    perc_multa_faixa_mais_7d     BETWEEN 0 AND 100
    AND perc_multa_faixa_7d_48h  BETWEEN 0 AND 100
    AND perc_multa_faixa_48h_24h BETWEEN 0 AND 100
    AND perc_multa_faixa_24h     BETWEEN 0 AND 100),
  CONSTRAINT chk_pagamento_tentativas CHECK (numero_tentativas BETWEEN 0 AND 3),  -- RN048 (limite fixo)
  -- RN018/RF030: forma_pagamento e anulavel ate a escolha do cliente, por isso o
  -- primeiro ramo usa o operador null-safe (<=>): com '=', a linha "sem forma de
  -- pagamento, mas com cartao vinculado" avalia para NULL e o CHECK a aceitaria.
  CONSTRAINT chk_pagamento_cartao CHECK (     -- RN018
    (forma_pagamento <=> 'cartao' AND id_cartao_credito IS NOT NULL)
    OR (forma_pagamento IN ('pix','boleto') AND id_cartao_credito IS NULL)
    OR (forma_pagamento IS NULL AND id_cartao_credito IS NULL)),
  -- RF047/RF058/UC 034: pagamento "pago" carrega a forma escolhida, a data e o
  -- identificador devolvidos pelo gateway — os três impressos no comprovante.
  CONSTRAINT chk_pagamento_pago CHECK (
    status <> 'pago'
    OR (forma_pagamento IS NOT NULL
        AND data_pagamento IS NOT NULL
        AND id_transacao_gateway IS NOT NULL)),
  CONSTRAINT chk_pagamento_data_repasse CHECK (
    (status_repasse = 'liberado' AND data_repasse IS NOT NULL)
    OR (status_repasse <> 'liberado' AND data_repasse IS NULL)),
  CONSTRAINT fk_pagamento_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_pagamento_cartao FOREIGN KEY (id_cartao_credito)
    REFERENCES cartao_credito (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 6. CANCELAMENTO
-- =====================================================================

CREATE TABLE cancelamento (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao    BIGINT UNSIGNED NOT NULL,
  solicitado_por    ENUM('cliente','fornecedor','sistema') NOT NULL,
  motivo            VARCHAR(1000) NOT NULL,
  data_solicitacao  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_reembolso   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_multa       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status            ENUM('em_analise','processando','concluido') NOT NULL DEFAULT 'em_analise',
  status_repasse    ENUM('pendente','liberado','nao_aplicavel') NOT NULL DEFAULT 'nao_aplicavel',
  data_repasse      DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cancelamento_solicitacao (id_solicitacao),  -- RN007: um por solicitação, permanente
  KEY ix_cancelamento_repasse (status_repasse, status),
  CONSTRAINT chk_cancelamento_valores CHECK (valor_reembolso >= 0 AND valor_multa >= 0),
  -- RN051/RN066: cancelamento por fornecedor ou pelo sistema nunca gera multa
  CONSTRAINT chk_cancelamento_origem CHECK (
    solicitado_por = 'cliente' OR valor_multa = 0),
  -- RN057: só há repasse a controlar quando houve multa retida
  CONSTRAINT chk_cancelamento_repasse CHECK (
    (valor_multa > 0 AND status_repasse IN ('pendente','liberado'))
    OR (valor_multa = 0 AND status_repasse = 'nao_aplicavel')),
  CONSTRAINT chk_cancelamento_data_repasse CHECK (
    (status_repasse = 'liberado' AND data_repasse IS NOT NULL)
    OR (status_repasse <> 'liberado' AND data_repasse IS NULL)),
  CONSTRAINT fk_cancelamento_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 7. AVALIAÇÃO E MODERAÇÃO
-- =====================================================================

CREATE TABLE avaliacao (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitacao    BIGINT UNSIGNED NOT NULL,
  nota              TINYINT UNSIGNED NOT NULL,
  comentario        TEXT          NULL,
  data_avaliacao    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status_avaliacao  ENUM('visivel','oculta') NOT NULL DEFAULT 'visivel',
  origem_ocultacao  ENUM('usuario','moderacao') NULL,
  motivo_ocultacao  VARCHAR(500)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_avaliacao_solicitacao (id_solicitacao),  -- RN006
  CONSTRAINT chk_avaliacao_nota CHECK (nota BETWEEN 1 AND 5),  -- RF037
  -- RN062: motivo é obrigatório apenas quando a ocultação vem da moderação
  CONSTRAINT chk_avaliacao_ocultacao CHECK (
    (status_avaliacao = 'visivel' AND origem_ocultacao IS NULL AND motivo_ocultacao IS NULL)
    OR (status_avaliacao = 'oculta' AND origem_ocultacao <=> 'usuario' AND motivo_ocultacao IS NULL)
    OR (status_avaliacao = 'oculta' AND origem_ocultacao <=> 'moderacao' AND motivo_ocultacao IS NOT NULL)),
  CONSTRAINT fk_avaliacao_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- RN052: a denúncia não guarda o fornecedor envolvido, por ser sempre derivável:
--   tipo 'avaliacao'  -> avaliacao -> solicitacao -> servico -> fornecedor
--   tipo 'fornecedor' -> solicitacao -> servico -> fornecedor
-- Guardá-lo criaria um invariante que o SGBD não consegue impor (o fornecedor
-- gravado poderia divergir do fornecedor do alvo).
CREATE TABLE denuncia (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo_denuncia          ENUM('avaliacao','fornecedor') NOT NULL,
  id_avaliacao           BIGINT UNSIGNED NULL COMMENT 'obrigatório quando tipo_denuncia = avaliacao',
  id_solicitacao         BIGINT UNSIGNED NULL COMMENT 'obrigatório quando tipo_denuncia = fornecedor',
  motivo_padrao          ENUM('conteudo_inadequado','conduta_no_chat','servico_nao_prestado',
                              'servico_divergente','cobranca_fora_da_plataforma',
                              'informacoes_falsas','outro') NOT NULL,
  motivo                 VARCHAR(1000) NOT NULL COMMENT 'descrição livre do denunciante',
  data_denuncia          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status_denuncia        ENUM('pendente','analisada') NOT NULL DEFAULT 'pendente',
  resultado_analise      ENUM('procedente','improcedente') NULL,
  justificativa_analise  VARCHAR(500)  NULL,
  data_analise           DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_denuncia_avaliacao (id_avaliacao),      -- RN052
  UNIQUE KEY uk_denuncia_solicitacao (id_solicitacao),  -- RN052
  KEY ix_denuncia_triagem (status_denuncia, data_denuncia),
  -- RN052: alvo exclusivo conforme o tipo. Os discriminadores são NOT NULL,
  -- portanto o operador '=' não cai na armadilha do NULL aqui.
  CONSTRAINT chk_denuncia_alvo CHECK (
    (tipo_denuncia = 'avaliacao'   AND id_avaliacao IS NOT NULL AND id_solicitacao IS NULL)
    OR (tipo_denuncia = 'fornecedor' AND id_solicitacao IS NOT NULL AND id_avaliacao IS NULL)),
  -- RN052: motivos compatíveis com o tipo de denúncia
  CONSTRAINT chk_denuncia_motivo CHECK (
    (tipo_denuncia = 'avaliacao'   AND motivo_padrao IN ('conteudo_inadequado','outro'))
    OR (tipo_denuncia = 'fornecedor' AND motivo_padrao <> 'conteudo_inadequado')),
  -- RF068/UC 026: a análise encerra-se sempre com resultado e justificativa
  CONSTRAINT chk_denuncia_analise CHECK (
    (status_denuncia = 'analisada'
       AND data_analise IS NOT NULL
       AND resultado_analise IS NOT NULL
       AND justificativa_analise IS NOT NULL)
    OR (status_denuncia = 'pendente'
       AND data_analise IS NULL
       AND resultado_analise IS NULL
       AND justificativa_analise IS NULL)),
  CONSTRAINT fk_denuncia_avaliacao FOREIGN KEY (id_avaliacao)
    REFERENCES avaliacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_denuncia_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 8. FINANCEIRO DO FORNECEDOR
-- =====================================================================

-- RN060: o saque não referencia os repasses que o compõem. O saldo disponível
-- é sempre calculado (ver VIEW vw_saldo_fornecedor ao final).
CREATE TABLE saque (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_fornecedor         BIGINT UNSIGNED NOT NULL,
  valor                 DECIMAL(10,2) NOT NULL,
  data_solicitacao      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status                ENUM('pendente','processando','concluido','recusado') NOT NULL DEFAULT 'pendente',
  motivo_recusa         VARCHAR(500)  NULL,
  id_transacao_gateway  VARCHAR(100)  NULL,
  data_processamento    DATETIME      NULL,
  PRIMARY KEY (id),
  KEY ix_saque_fornecedor (id_fornecedor, status),
  CONSTRAINT chk_saque_valor CHECK (valor > 0),  -- piso de R$20 é parametrizável (RN014)
  CONSTRAINT chk_saque_recusa CHECK (
    (status = 'recusado' AND motivo_recusa IS NOT NULL)
    OR (status <> 'recusado' AND motivo_recusa IS NULL)),
  CONSTRAINT fk_saque_fornecedor FOREIGN KEY (id_fornecedor)
    REFERENCES fornecedor (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE dados_recebimento (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cancelamento    BIGINT UNSIGNED NULL,
  id_saque           BIGINT UNSIGNED NULL,
  tipo_recebimento   ENUM('pix','conta_bancaria') NOT NULL,
  chave_pix          VARCHAR(140) NULL,
  tipo_chave_pix     ENUM('cpf','cnpj','email','telefone','aleatoria') NULL,
  banco              VARCHAR(100) NULL,
  tipo_conta         ENUM('corrente','poupanca') NULL,
  agencia            VARCHAR(10)  NULL,
  numero_conta       VARCHAR(20)  NULL,
  cpf_cnpj_titular   VARCHAR(14)  NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  nome_titular       VARCHAR(150) NULL COMMENT 'NULL após exclusão de conta (RN044-A)',
  data_envio         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status_validacao   ENUM('pendente','validado','rejeitado') NOT NULL DEFAULT 'pendente',
  motivo_rejeicao    VARCHAR(500) NULL COMMENT 'texto devolvido pela administração (RF062); exibido ao ator no reenvio (RN061)',
  PRIMARY KEY (id),
  -- RN061: o reenvio substitui o registro anterior; não há histórico
  UNIQUE KEY uk_dados_recebimento_cancelamento (id_cancelamento),
  UNIQUE KEY uk_dados_recebimento_saque (id_saque),
  KEY ix_dados_recebimento_validacao (status_validacao),
  -- RN061/RF062: a rejeição precisa dizer o porquê, senão o ator reenvia no escuro.
  -- Forma estrita (como chk_saque_recusa): ao voltar para 'pendente' no reenvio,
  -- o motivo anterior tem de ser limpo junto.
  CONSTRAINT chk_dados_recebimento_rejeicao CHECK (
    (status_validacao = 'rejeitado' AND motivo_rejeicao IS NOT NULL)
    OR (status_validacao <> 'rejeitado' AND motivo_rejeicao IS NULL)),
  CONSTRAINT chk_dados_recebimento_vinculo CHECK (
    (id_cancelamento IS NOT NULL AND id_saque IS NULL)
    OR (id_cancelamento IS NULL AND id_saque IS NOT NULL)),
  -- Verifica apenas o lado "deve ser NULL", para sobreviver à anonimização (RN044-A).
  -- A obrigatoriedade do lado preenchido é validada na aplicação, no envio.
  CONSTRAINT chk_dados_recebimento_tipo CHECK (
    (tipo_recebimento = 'pix' AND banco IS NULL AND tipo_conta IS NULL
       AND agencia IS NULL AND numero_conta IS NULL)
    OR (tipo_recebimento = 'conta_bancaria' AND chave_pix IS NULL AND tipo_chave_pix IS NULL)),
  CONSTRAINT fk_dados_recebimento_cancelamento FOREIGN KEY (id_cancelamento)
    REFERENCES cancelamento (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_dados_recebimento_saque FOREIGN KEY (id_saque)
    REFERENCES saque (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 9. NOTIFICAÇÕES E CONFIGURAÇÃO
-- =====================================================================

CREATE TABLE notificacao (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario      BIGINT UNSIGNED NOT NULL COMMENT 'destinatário',
  tipo            ENUM('solicitacao','pagamento','cancelamento','avaliacao',
                       'mensagem','servico','conta','financeiro') NOT NULL,
  titulo          VARCHAR(150)  NOT NULL,
  mensagem        VARCHAR(1000) NOT NULL COMMENT 'texto congelado na criação (RN065)',
  id_solicitacao  BIGINT UNSIGNED NULL COMMENT 'preenchido só quando há item navegável',
  lida            BOOLEAN  NOT NULL DEFAULT FALSE,
  data_criacao    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_leitura    DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_notificacao_central (id_usuario, lida, data_criacao DESC),
  CONSTRAINT chk_notificacao_leitura CHECK (
    (lida = TRUE AND data_leitura IS NOT NULL)
    OR (lida = FALSE AND data_leitura IS NULL)),
  -- RF064/RN065: só as notificações com item navegável guardam a referência da
  -- solicitação; as de serviço, conta e financeiro identificam-se apenas pelo tipo.
  -- O tipo 'mensagem' (RF026/RN022) avisa da chegada de mensagem no chat e, como
  -- o chat é vinculado à solicitação, entra no grupo que exige a referência.
  CONSTRAINT chk_notificacao_referencia CHECK (
    (tipo IN ('solicitacao','pagamento','cancelamento','avaliacao','mensagem')
       AND id_solicitacao IS NOT NULL)
    OR (tipo IN ('servico','conta','financeiro') AND id_solicitacao IS NULL)),
  CONSTRAINT fk_notificacao_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_notificacao_solicitacao FOREIGN KEY (id_solicitacao)
    REFERENCES solicitacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE configuracao (
  id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chave           VARCHAR(80)   NOT NULL COMMENT 'a unidade faz parte do nome (_horas, _dias)',
  descricao       VARCHAR(500)  NOT NULL,
  valor           DECIMAL(10,2) NOT NULL,
  data_alteracao  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_configuracao_chave (chave)
) ENGINE=InnoDB;

-- =====================================================================
-- 10. VIEW DE APOIO — saldo disponível do fornecedor (RN060)
-- =====================================================================

CREATE OR REPLACE VIEW vw_saldo_fornecedor AS
SELECT
  f.id AS id_fornecedor,
  COALESCE(rep.total_liberado, 0.00) - COALESCE(saq.total_comprometido, 0.00) AS saldo_disponivel
FROM fornecedor f
LEFT JOIN (
  -- repasses liberados: por conclusão (RN056) e por multa de cancelamento (RN057)
  SELECT id_fornecedor, SUM(valor) AS total_liberado FROM (
    SELECT s.id_fornecedor, p.valor_repassado AS valor
      FROM pagamento p
      JOIN solicitacao so ON so.id = p.id_solicitacao
      JOIN servico s      ON s.id  = so.id_servico
     WHERE p.status_repasse = 'liberado'
    UNION ALL
    SELECT s.id_fornecedor, c.valor_multa AS valor
      FROM cancelamento c
      JOIN solicitacao so ON so.id = c.id_solicitacao
      JOIN servico s      ON s.id  = so.id_servico
     WHERE c.status_repasse = 'liberado'
  ) AS t GROUP BY id_fornecedor
) AS rep ON rep.id_fornecedor = f.id
LEFT JOIN (
  SELECT id_fornecedor, SUM(valor) AS total_comprometido
    FROM saque
   WHERE status IN ('pendente','processando','concluido')
   GROUP BY id_fornecedor
) AS saq ON saq.id_fornecedor = f.id;

-- =====================================================================
-- 10-B. CONSULTA DE REFERÊNCIA — vitrine com filtro de proximidade (RF014, RN068)
-- Não faz parte do DDL; documenta como a RN068 é resolvida em consulta.
-- ST_Distance_Sphere recebe POINT(longitude, latitude) — nessa ordem — e
-- devolve metros. Na ausência de coordenada de qualquer das partes, a
-- aplicação troca o predicado de distância pela igualdade de cidade/estado.
--
--   SELECT s.id, s.nome, s.preco_base,
--          ROUND(ST_Distance_Sphere(POINT(uf.longitude, uf.latitude),
--                                   POINT(uc.longitude, uc.latitude)) / 1000, 1) AS distancia_km
--     FROM servico s
--     JOIN fornecedor f  ON f.id  = s.id_fornecedor
--     JOIN usuario    uf ON uf.id = f.id_usuario      -- sede do fornecedor
--     JOIN cliente    c  ON c.id  = ?                 -- cliente autenticado
--     JOIN usuario    uc ON uc.id = c.id_usuario      -- localização-base do cliente
--    WHERE s.status_servico = 'ativo'
--      AND s.status_verificacao = 'aprovado'
--      AND f.status_fornecedor = 'ativo'
--      AND uf.latitude IS NOT NULL AND uc.latitude IS NOT NULL
--      AND ST_Distance_Sphere(POINT(uf.longitude, uf.latitude),
--                             POINT(uc.longitude, uc.latitude)) <= f.raio_atendimento_km * 1000
--    ORDER BY distancia_km;
-- =====================================================================

-- =====================================================================
-- 11. CARGA INICIAL
-- =====================================================================

INSERT INTO administrador (nome, email, senha_hash) VALUES
  ('Administração Festeirinho', 'admin@festeirinho.com',
   '$2b$10$z2r.GYeCZITi495X3aJhKO3bwCZT2G59qaxQ3TAYke0HT1IGmQlwa');

INSERT INTO cobranca (descricao) VALUES ('hora'), ('pessoa'), ('fixo');

INSERT INTO tipo_local (descricao) VALUES
  ('Residência'), ('Salão'), ('Chácara'), ('Condomínio'), ('Outro');

INSERT INTO categoria (nome) VALUES
  ('Buffet'), ('Decoração'), ('Animação'), ('Bolos e doces'),
  ('Brinquedos e estrutura'), ('Fotografia e filmagem'), ('Som e iluminação'),
  ('Personagens vivos'), ('Convites e lembrancinhas'), ('Outro');

INSERT INTO configuracao (chave, valor, descricao) VALUES
  ('percentual_comissao',                  10.00, '% de comissão retida pela plataforma no repasse ao fornecedor (RN027)'),
  ('prazo_resposta_fornecedor_horas',      48.00, 'Prazo máximo para o fornecedor responder à solicitação (RN035)'),
  ('prazo_pagamento_horas',                24.00, 'Prazo de pagamento para Pix e cartão, contado da geração do pagamento (RN024)'),
  ('antecedencia_minima_boleto_dias',       5.00, 'Antecedência mínima em relação ao evento para ofertar boleto (RN012)'),
  ('prazo_confirmacao_conclusao_horas',    72.00, 'Prazo do cliente para confirmar a conclusão do serviço (RN039)'),
  ('prazo_registro_conclusao_dias',         7.00, 'Prazo do fornecedor para registrar a conclusão, contado do término previsto do evento (RN066)'),
  ('periodo_carencia_repasse_dias',         7.00, 'Carência para liberação do repasse após a confirmação de conclusão (RN056)'),
  ('multa_cancelamento_faixa_mais_7d',      0.00, '% de multa — cancelamento pelo cliente com 7 dias ou mais de antecedência (RN050)'),
  ('multa_cancelamento_faixa_7d_48h',      25.00, '% de multa — cancelamento pelo cliente entre 7 dias e 48h antes do evento (RN050)'),
  ('multa_cancelamento_faixa_48h_24h',     50.00, '% de multa — cancelamento pelo cliente entre 48h e 24h antes do evento (RN050)'),
  ('multa_cancelamento_faixa_24h',        100.00, '% de multa — cancelamento pelo cliente com menos de 24h de antecedência (RN050)'),
  ('valor_minimo_saque',                   20.00, 'Valor mínimo (R$) permitido por solicitação de saque do fornecedor (RN060)'),
  ('prazo_denuncia_fornecedor_dias',       30.00, 'Prazo do cliente para denunciar o fornecedor, contado da confirmação de conclusão ou do registro do cancelamento (RN052)'),
  ('periodo_inatividade_cliente_dias',    180.00, 'Dias sem login para inativação automática do cliente (RN043)'),
  ('periodo_inatividade_fornecedor_dias', 180.00, 'Dias sem login para inativação automática do fornecedor (RN047)'),
  ('raio_atendimento_padrao_km',            30.00, 'Raio de atendimento (km) sugerido ao fornecedor no cadastro (RN068)');
