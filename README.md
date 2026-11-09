# Festeirinho
 
Plataforma web para contratação de serviços para festas infantis, conectando clientes a fornecedores (buffet, decoração, animação, fotografia, entre outros).
 
O sistema cobre o ciclo completo da contratação: busca de serviços, envio da solicitação, aprovação pelo fornecedor, pagamento, execução, avaliação e resolução de disputas.
 
Projeto desenvolvido como Trabalho de Conclusão de Curso do curso de Análise e Desenvolvimento de Sistemas da Fatec Franca.
 
## Tecnologias
 
- **Next.js** (App Router) — telas e rotas de API no mesmo projeto
- **JavaScript** e **React**
- **Tailwind CSS** para estilização
- **MySQL 8.0.16+** como banco de dados
- **mysql2** para acesso ao banco, com SQL escrito à mão
- **bcryptjs** para hash de senhas
- **jose** para geração e validação de tokens de sessão

## Como rodar

Pré-requisitos:

- [Git](https://git-scm.com)
- [Node.js](https://nodejs.org) 20.9 ou superior (a versão LTS atende)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) 8.0.16 ou superior, na porta padrão 3306 (recomendado: 8.4 LTS). O MySQL Workbench é opcional. O MariaDB, que vem no XAMPP e no WampServer, não é compatível com o DDL.

1. Clone o repositório e instale as dependências:

   ```
   git clone https://github.com/rafaelasimion/festeirinho.git
   cd festeirinho
   npm install
   ```

2. Crie o banco a partir do DDL:

   ```
   mysql -u root -p --default-character-set=utf8mb4 < docs/banco-de-dados/festeirinho-ddl.sql
   ```

   No Windows, use o Prompt de Comando, porque o PowerShell não aceita o `<`, e o caminho completo do cliente, se ele não estiver no PATH:

   ```
   "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p --default-character-set=utf8mb4 < docs\banco-de-dados\festeirinho-ddl.sql
   ```

   Não omita o `--default-character-set=utf8mb4`: sem ele, dependendo do terminal, os acentos são gravados errados. Pelo MySQL Workbench, basta abrir o arquivo em *File › Open SQL Script* e executá-lo.

3. Crie o arquivo `.env.local` na raiz do projeto. Ele não vai para o repositório, então cada máquina tem o seu:

   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=senha_do_root_do_mysql
   DB_NAME=festeirinho
   JWT_SECRET=chave_aleatoria_longa
   ```

   O `JWT_SECRET` é obrigatório: sem ele, nenhum login funciona. Para gerar um, rode `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Evite `#` e `$` na senha do banco, porque o Next.js trata esses caracteres de forma especial nesse arquivo. `SUPORTE_EMAIL` e `SUPORTE_WHATSAPP` são opcionais e preenchem os contatos da página de suporte.

4. Rode o sistema:

   ```
   npm run dev
   ```

   O sistema abre em http://localhost:3000. O painel do administrador fica em http://localhost:3000/admin/login, e o DDL já cria um administrador de demonstração: `admin@festeirinho.com`, senha `admin@festeirinho2026`. Para rodar os testes automatizados, que não dependem do banco, use `npm test`.

## Documentação

Requisitos, regras de negócio, casos de uso, diagramas e scripts do banco de dados estão na pasta [docs](docs/README.md).

## Autores
 
- Rafaela Maniero Simion
- Fabio Tostes Fernandes

---

**Orientador:** Prof. Leonardo Raiz
**Instituição:** Fatec Franca — Análise e Desenvolvimento de Sistemas