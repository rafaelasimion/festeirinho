# Documentação do Festeirinho

Documentação do Trabalho de Graduação **Sistema Festeirinho: plataforma para planejamento e contratação de serviços para festas infantis**, do curso de Análise e Desenvolvimento de Sistemas da Fatec Franca (2026).

- **Autores:** Fábio Augusto Tostes Fernandes e Rafaela Cristina Maniero Simion
- **Orientador:** Prof. Me. Leonardo Henrique Raiz

## Formatos

- **Documentos de texto:** PDF, que o GitHub abre no navegador.
- **Diagramas:** imagem em SVG, que fica nítida em qualquer zoom, junto com o arquivo editável. No DER, um arquivo só serve para as duas coisas: o `der.drawio.svg` é uma imagem e também abre para edição no draw.io.
- **Banco de dados:** os próprios scripts `.sql`.

## Documentação

| Documento | Arquivo |
| --- | --- |
| Requisitos funcionais | [requisitos-funcionais.pdf](documentacao/requisitos-funcionais.pdf) |
| Requisitos não funcionais | [requisitos-nao-funcionais.pdf](documentacao/requisitos-nao-funcionais.pdf) |
| Regras de negócio | [regras-de-negocio.pdf](documentacao/regras-de-negocio.pdf) |
| Casos de uso | [casos-de-uso.pdf](documentacao/casos-de-uso.pdf) |
| Matriz de rastreabilidade | [matriz-de-rastreabilidade.pdf](documentacao/matriz-de-rastreabilidade.pdf) |
| Resumo do projeto | [festeirinho-resumo.pdf](documentacao/festeirinho-resumo.pdf) |

## Diagramas

| Diagrama | Imagem | Arquivo editável |
| --- | --- | --- |
| Processo de contratação (BPMN) | [processo-de-contratacao.svg](diagramas/bpmn/processo-de-contratacao.svg) | [processo-de-contratacao.bpmn](diagramas/bpmn/processo-de-contratacao.bpmn), no bpmn.io |
| Entidade-relacionamento (DER) | [der.drawio.svg](diagramas/der/der.drawio.svg) | o mesmo arquivo, no draw.io |
| Estados da solicitação | [estados-da-solicitacao.svg](diagramas/estados-da-solicitacao.svg) | o próprio SVG |
| Arquitetura | [arquitetura.svg](diagramas/arquitetura.svg) | o próprio SVG |

### Casos de uso

Cada diagrama tem a imagem e o código PlantUML que a gera.

| Diagrama | Imagem | PlantUML |
| --- | --- | --- |
| 01 – Conta e acesso | [SVG](diagramas/casos-de-uso/01-conta-e-acesso.svg) | [.puml](diagramas/casos-de-uso/01-conta-e-acesso.puml) |
| 02 – Catálogo de serviços e vitrine | [SVG](diagramas/casos-de-uso/02-catalogo-de-servicos.svg) | [.puml](diagramas/casos-de-uso/02-catalogo-de-servicos.puml) |
| 03 – Contratação | [SVG](diagramas/casos-de-uso/03-contratacao.svg) | [.puml](diagramas/casos-de-uso/03-contratacao.puml) |
| 04 – Pagamento | [SVG](diagramas/casos-de-uso/04-pagamento.svg) | [.puml](diagramas/casos-de-uso/04-pagamento.puml) |
| 05 – Cancelamento e reembolso | [SVG](diagramas/casos-de-uso/05-cancelamento-e-reembolso.svg) | [.puml](diagramas/casos-de-uso/05-cancelamento-e-reembolso.puml) |
| 06 – Conclusão, avaliação e contestação | [SVG](diagramas/casos-de-uso/06-conclusao-e-contestacao.svg) | [.puml](diagramas/casos-de-uso/06-conclusao-e-contestacao.puml) |
| 07 – Financeiro do fornecedor | [SVG](diagramas/casos-de-uso/07-financeiro-do-fornecedor.svg) | [.puml](diagramas/casos-de-uso/07-financeiro-do-fornecedor.puml) |
| 08 – Moderação, denúncias, suporte e parâmetros | [SVG](diagramas/casos-de-uso/08-moderacao-denuncias-e-suporte.svg) | [.puml](diagramas/casos-de-uso/08-moderacao-denuncias-e-suporte.puml) |

## Banco de dados

| Script | Para que serve |
| --- | --- |
| [festeirinho-ddl.sql](banco-de-dados/festeirinho-ddl.sql) | Cria o banco, as 23 tabelas, as restrições e a carga inicial: domínios, parâmetros e um administrador |
| [festeirinho-smoke-test.sql](banco-de-dados/festeirinho-smoke-test.sql) | Percorre dois cenários completos, uma contratação concluída e um cancelamento com multa, e confere os valores |
| [festeirinho-testes-restricoes.sql](banco-de-dados/festeirinho-testes-restricoes.sql) | Tenta gravar dados que violam as regras e confere se o banco os recusa |

Para recriar o banco num MySQL 8.0.16 ou superior, execute os scripts nesta ordem, a partir da raiz do repositório:

```
mysql -u root -p < docs/banco-de-dados/festeirinho-ddl.sql
mysql -u root -p < docs/banco-de-dados/festeirinho-smoke-test.sql
mysql -u root -p --table < docs/banco-de-dados/festeirinho-testes-restricoes.sql
```

O DDL cria o banco do zero; se o servidor já tiver um banco `festeirinho`, apague-o antes. Os outros dois scripts gravam dados de demonstração, por isso devem rodar num banco de testes. O último executa cada teste dentro de uma transação desfeita em seguida e mostra, no fim, quantos foram aprovados.

A carga inicial do DDL cria um administrador de demonstração. Troque a senha dele antes de usar o sistema fora do ambiente de testes.

## Como atualizar os diagramas

- **BPMN:** abra o `.bpmn` no [bpmn.io](https://demo.bpmn.io), edite e baixe de novo o diagrama (`.bpmn`) e a imagem (SVG), com os mesmos nomes.
- **DER:** abra o `der.drawio.svg` no [draw.io](https://app.diagrams.net) e salve; o arquivo continua sendo imagem e diagrama editável ao mesmo tempo.
- **Casos de uso:** edite o `.puml` e gere o SVG de novo no PlantUML, pelo site ou com `java -jar plantuml.jar -tsvg *.puml` dentro da pasta.
- **Estados e arquitetura:** edite o SVG num editor vetorial, como o Inkscape.
