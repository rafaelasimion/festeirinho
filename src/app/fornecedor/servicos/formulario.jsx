'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import Campo, { CampoSelecao, CampoTexto } from '@/componentes/campo';
import SecaoFormulario from '@/componentes/secao-formulario';
import GerenciarFotos from '@/componentes/gerenciar-fotos';
import { ROTULO_COBRANCA } from '@/lib/solicitacao';
import { lerInteiro, lerDecimal } from '@/lib/validacao';

const CAMPOS_VAZIOS = {
  nome: '',
  descricao: '',
  idCategoria: '',
  idCobranca: '',
  precoBase: '',
  capacidadeMax: '',
  diasAntecedencia: '',
};

// O formulário em si. Sem ?novo nem ?editar não há o que fazer nesta
// tela, e o fluxo volta para a vitrine.
export default function FormularioServico() {
  const parametros = useSearchParams();
  const router = useRouter();
  const [servicos, setServicos] = useState(null);
  const [opcoes, setOpcoes] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'novo' | id do serviço
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregarServicos() {
    const resposta = await fetch('/api/fornecedor/servicos');
    if (resposta.status === 401) {
      router.push('/login');
      return;
    }
    if (!resposta.ok) {
      setErroGeral('Não foi possível carregar seus serviços.');
      return;
    }
    setServicos(await resposta.json());
  }

  useEffect(() => {
    async function carregarTudo() {
      try {
        const respostaOpcoes = await fetch('/api/opcoes');
        if (respostaOpcoes.ok) {
          setOpcoes(await respostaOpcoes.json());
        } else {
          setErroGeral('Não foi possível carregar categorias e formas de cobrança.');
        }
        await carregarServicos();
      } catch {
        setErroGeral('Falha de conexão.');
      }
    }
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre o formulário assim que os dados chegam. Depende de `servicos`
  // porque editar precisa do serviço carregado para preencher os campos.
  //
  // O `?editar=5` da URL é uma intenção que se cumpre UMA vez, e é isso que o
  // useRef marca. Sem ele, o efeito voltava a disparar depois de salvar: o
  // salvar() fecha o formulário com setEditando(null) e recarrega a lista,
  // `servicos` ganha identidade nova, a guarda `editando !== null` já não
  // vale, e o efeito reabria o formulário chamando abrirEdicao — que limpa a
  // mensagem. Resultado medido no navegador: a confirmação não aparecia em
  // nenhum instante, e com ela se perdia o aviso da RN067 de que o serviço
  // saiu da vitrine até a nova aprovação, que é justamente o que o
  // fornecedor precisa saber ali.
  const intencaoDaUrlAtendida = useRef(false);

  useEffect(() => {
    if (servicos === null || opcoes === null || editando !== null) return;

    // Marcada só aqui, depois dos nulos: antes disso os dados ainda não
    // chegaram, e consumir a intenção cedo deixaria o formulário sem abrir.
    if (intencaoDaUrlAtendida.current) return;
    intencaoDaUrlAtendida.current = true;

    if (parametros.get('novo') !== null) {
      abrirNovo();
      return;
    }

    const idEditar = Number(parametros.get('editar'));
    if (Number.isInteger(idEditar)) {
      const servico = servicos.find((s) => s.id === idEditar);
      if (servico) {
        abrirEdicao(servico);
        return;
      }
    }

    // Nem cadastro nem edição: não há tela aqui.
    router.replace('/fornecedor/vitrine');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos, opcoes]);

  const antecedenciaMinima = opcoes?.antecedenciaMinimaDias ?? 1;

  // As três validações numéricas usam os MESMOS leitores do servidor e dizem
  // as MESMAS frases que ele. Antes eram funções anônimas sobre Number(), e
  // discordavam dele em todos os casos não inteiros: capacidade "7,5" passava
  // no blur e era recusada no envio, e "4,5" de antecedência levava
  // "o mínimo é 4 dias" — que não descreve o erro, porque 4,5 está acima de 4.
  // O que falha ali é ser fracionário, e agora a mensagem diz isso.
  function validarPreco(valor) {
    const n = lerDecimal(valor, { casas: 2 });
    if (n === null) {
      return String(valor ?? '').trim() === ''
        ? 'Informe o preço base.'
        : 'Informe o preço com no máximo duas casas decimais (ex.: 89,90).';
    }
    if (n <= 0) return 'Informe um preço maior que zero.';
    if (n > 99999999.99) return 'Preço acima do limite permitido.';
    return null;
  }

  function validarCapacidade(valor) {
    if (String(valor ?? '').trim() === '') return null;   // em branco: sem limite
    const n = lerInteiro(valor);
    if (n === null || n <= 0) {
      return 'Informe uma capacidade inteira maior que zero, ou deixe em branco.';
    }
    return null;
  }

  function validarAntecedencia(valor) {
    const n = lerInteiro(valor);
    if (n === null) {
      return String(valor ?? '').trim() === ''
        ? 'Informe a antecedência mínima em dias.'
        : 'A antecedência precisa ser um número inteiro de dias.';
    }
    if (n < antecedenciaMinima) {
      return `A antecedência mínima permitida é de ${antecedenciaMinima} dias.`;
    }
    return null;
  }

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setMensagem('');
  }

  function abrirNovo() {
    setCampos({
      ...CAMPOS_VAZIOS,
      diasAntecedencia: String(opcoes?.antecedenciaMinimaDias ?? ''),
    });
    setErros({});
    setMensagem('');
    setEditando('novo');
  }

  function abrirEdicao(servico) {
    setCampos({
      nome: servico.nome,
      descricao: servico.descricao,
      idCategoria: String(servico.id_categoria),
      idCobranca: String(servico.id_cobranca),
      precoBase: String(servico.preco_base),
      capacidadeMax: servico.capacidade_max === null ? '' : String(servico.capacidade_max),
      diasAntecedencia: String(servico.dias_antecedencia),
    });
    setErros({});
    setMensagem('');
    setEditando(servico.id);
  }

  async function salvar() {
    setErros({});
    setErroGeral('');
    setMensagem('');
    setSalvando(true);

    const ehNovo = editando === 'novo';

    // Os números vão como TEXTO, e a conversão é do servidor.
    //
    // Este era o único formulário do sistema que convertia antes de enviar, e
    // isso desmontava as mensagens de erro: Number('1.000.00') é NaN, o
    // JSON.stringify serializa NaN como null, e o servidor recebia null —
    // isto é, "não informou" — para um campo visivelmente preenchido. A
    // pessoa lia "Informe o preço base" olhando o preço digitado.
    //
    // Só as duas seleções continuam convertidas: ali o valor vem de um
    // <option>, não de digitação.
    const corpo = {
      ...campos,
      idCategoria: Number(campos.idCategoria),
      idCobranca: Number(campos.idCobranca),
      capacidadeMax: campos.capacidadeMax === '' ? null : campos.capacidadeMax,
    };

    try {
      const resposta = await fetch(
        ehNovo ? '/api/fornecedor/servicos' : `/api/fornecedor/servicos/${editando}`,
        {
          method: ehNovo ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
        }
      );

      const dados = await resposta.json();

      if (resposta.ok) {
        if (ehNovo) {
          // UC 008, passo 4 — as fotos fazem parte do cadastro, mas só podem
          // ser penduradas num serviço que já existe. Então o formulário
          // continua aberto, agora em modo de edição, com as fotos liberadas.
          setEditando(dados.id);
          setMensagem('Serviço cadastrado. Agora adicione as fotos — a primeira vira a principal.');
        } else {
          setEditando(null);
          setMensagem(
            dados.voltouParaVerificacao
              ? 'Serviço salvo. Como você mudou nome, descrição, categoria ou preço, ele saiu da vitrine até a nova aprovação.'
              : 'Serviço salvo.'
          );
        }
        await carregarServicos();
        return;
      }

      if (dados.erros) setErros(dados.erros);
      else setErroGeral(dados.erro ?? 'Não foi possível salvar.');
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }


  if (servicos === null || opcoes === null) {
    return <main className="mx-auto max-w-2xl p-6"><p className="text-sm">Carregando...</p></main>;
  }

  const editandoExistente = typeof editando === 'number';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/fornecedor/vitrine"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-festa-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para a vitrine
      </Link>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {editando === 'novo' ? 'Novo serviço' : 'Editar serviço'}
        </h1>
        <p className="mt-1.5 text-slate-600">
          {editando === 'novo'
            ? 'É assim que ele vai aparecer para os clientes.'
            : 'As mudanças valem para novas solicitações, não para as que já existem.'}
        </p>
      </div>

      {mensagem && (
        <p className="mt-6 rounded-xl bg-sucesso-50 px-4 py-3 text-sm text-sucesso-800">
          {mensagem}
        </p>
      )}
      {erroGeral && (
        <p className="mt-6 rounded-xl bg-perigo-50 px-4 py-3 text-sm text-perigo-700">
          {erroGeral}
        </p>
      )}

      {editando !== null && (
        <div className="mt-8 space-y-4">
          <SecaoFormulario numero={1} titulo="O que você oferece"
            descricao="O que o cliente lê antes de decidir.">
            <Campo label="Nome do serviço" name="nome" value={campos.nome}
              onChange={aoDigitar} erro={erros.nome}
              placeholder="Ex.: Buffet completo para 50 pessoas"
              validar={(v) => v.trim().length >= 3 ? null : 'Informe o nome do serviço.'} />

            <CampoTexto label="Descrição" name="descricao" rows={4}
              value={campos.descricao} onChange={aoDigitar} erro={erros.descricao}
              minimo={20}
              placeholder="O que está incluso, para que tipo de festa, o que você leva."
              validar={(v) => v.trim().length >= 20
                ? null
                : 'Descreva o serviço em ao menos 20 caracteres.'} />

            <CampoSelecao label="Categoria" name="idCategoria" value={campos.idCategoria}
              onChange={aoDigitar} erro={erros.idCategoria}>
              <option value="">Selecione</option>
              {opcoes?.categorias?.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
              ))}
            </CampoSelecao>
          </SecaoFormulario>

          <SecaoFormulario numero={2} titulo="Preço e limites"
            descricao="Como o valor é calculado e até onde você atende.">
            <CampoSelecao label="Forma de cobrança" name="idCobranca" value={campos.idCobranca}
              onChange={aoDigitar} erro={erros.idCobranca}
              dica="Define por quanto o preço base é multiplicado na solicitação.">
              <option value="">Selecione</option>
              {opcoes?.cobrancas?.map((cobranca) => (
                <option key={cobranca.id} value={cobranca.id}>
                  {ROTULO_COBRANCA[cobranca.descricao]}
                </option>
              ))}
            </CampoSelecao>

            <Campo label="Preço base (R$)" name="precoBase" type="number" step="0.01" min="0.01"
              value={campos.precoBase} onChange={aoDigitar} erro={erros.precoBase}
              validar={validarPreco} />

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo label="Capacidade máxima" name="capacidadeMax" type="number" min="1"
                value={campos.capacidadeMax} onChange={aoDigitar} erro={erros.capacidadeMax}
                dica="Em branco: sem limite."
                validar={validarCapacidade} />

              <Campo label="Antecedência mínima (dias)" name="diasAntecedencia" type="number"
                min={antecedenciaMinima}
                value={campos.diasAntecedencia} onChange={aoDigitar} erro={erros.diasAntecedencia}
                dica={`Mínimo da plataforma: ${opcoes ? antecedenciaMinima : '...'} dias.`}
                validar={validarAntecedencia} />
            </div>
          </SecaoFormulario>

          {/* RF012 — fotos, na mesma tela da edição. Só aparecem quando o
              serviço já existe; num serviço novo, logo depois de salvar. */}
          <SecaoFormulario numero={3} titulo="Fotos"
            descricao={editandoExistente
              ? 'Salvas na hora, sem precisar clicar em Salvar.'
              : 'Liberadas assim que o serviço for salvo pela primeira vez.'}>
            {editandoExistente ? (
              <GerenciarFotos idServico={editando} aoAlterar={carregarServicos} />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                A foto precisa de um serviço para ficar pendurada. Salve abaixo e
                o campo aparece aqui.
              </p>
            )}
          </SecaoFormulario>

          {/* RN031 e RN067 — quem cadastra precisa saber disto ANTES de
              escrever, não depois de salvar: o serviço nasce pendente e não
              aparece na busca até ser aprovado, e mexer em nome, descrição,
              categoria, preço ou fotos devolve um serviço já aprovado à
              análise. A tela antes só dizia isso na mensagem pós-salvamento. */}
          <div className="rounded-xl border border-festa-100 bg-festa-50 p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-festa-600" aria-hidden="true" />
              <p className="text-sm text-slate-700">
                {editando === 'novo'
                  ? 'Todo serviço passa pela análise da administração antes de aparecer na busca — é a conferência de que ele cabe no escopo de festas infantis.'
                  : 'Mudar nome, descrição, categoria, preço ou fotos devolve o serviço à análise, e ele sai da busca até a nova aprovação. As solicitações em andamento não são afetadas.'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={salvar} disabled={salvando}
              className="w-full rounded-xl bg-festa-600 px-4 py-3.5 font-semibold text-white transition-colors hover:bg-festa-700 disabled:cursor-not-allowed disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button type="button" onClick={() => router.push('/fornecedor/vitrine')}
              className="w-full rounded-xl border border-festa-600 bg-white px-4 py-3.5 font-semibold text-festa-700 transition-colors hover:bg-festa-50">
              {editandoExistente ? 'Concluir' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
