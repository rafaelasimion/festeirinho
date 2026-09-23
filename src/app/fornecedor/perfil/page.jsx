'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UFS, dataMaximaNascimento, IDADE_MINIMA } from '@/lib/validacao';
import Campo from '@/componentes/campo';
import Etiqueta from '@/componentes/etiqueta';
import FotoPerfil from '@/componentes/foto-perfil';
import MinhaLocalizacao from '@/componentes/minha-localizacao';

const ROTULO_VERIFICACAO = {
  pendente: 'Verificação pendente',
  aprovado: 'Perfil verificado',
  rejeitado: 'Verificação rejeitada',
};

const TOM_VERIFICACAO = {
  pendente: 'atencao',
  aprovado: 'sucesso',
  rejeitado: 'perigo',
};

const CLASSE_SELECT =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 ' +
  'focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30';

export default function PerfilFornecedor() {
  const router = useRouter();
  const [campos, setCampos] = useState(null);
  const [status, setStatus] = useState(null);
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [coordenadas, setCoordenadas] = useState(null);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carrega o perfil assim que a tela abre.
  useEffect(() => {
    async function carregar() {
      try {
        const resposta = await fetch('/api/fornecedor/perfil');
        if (resposta.status === 401) {
          router.push('/login');
          return;
        }
        if (!resposta.ok) {
          setErroGeral('Não foi possível carregar o perfil.');
          return;
        }
        const dados = await resposta.json();
        setCampos({
          nome: dados.nome ?? '',
          telefone: dados.telefone ?? '',
          cidade: dados.cidade ?? '',
          estado: dados.estado ?? '',
          cpf: dados.cpf ?? '',
          dataNascimento: dados.data_nascimento ?? '',
          cnpj: dados.cnpj ?? '',
          razaoSocial: dados.razao_social ?? '',
          nomeExibicao: dados.nome_exibicao ?? '',
          descricao: dados.descricao ?? '',
          instagramUrl: dados.instagram_url ?? '',
          whatsappUrl: dados.whatsapp_url ?? '',
          site: dados.site ?? '',
          raioAtendimentoKm: String(dados.raio_atendimento_km ?? 30),
        });
        setStatus({
          tipoPessoa: dados.tipo_pessoa,
          verificacao: dados.status_verificacao,
          fornecedor: dados.status_fornecedor,
          motivoRejeicao: dados.motivo_rejeicao,
        });
        setFotoPerfil(dados.foto_perfil ?? null);
        setCoordenadas(dados.latitude === null || dados.latitude === undefined ? null : {
          latitude: Number(dados.latitude),
          longitude: Number(dados.longitude),
        });
      } catch {
        setErroGeral('Falha de conexão ao carregar o perfil.');
      }
    }
    carregar();
  }, [router]);

  function aoDigitar(evento) {
    const { name, value } = evento.target;
    setCampos((anterior) => ({ ...anterior, [name]: value }));
    setErros((anterior) => ({ ...anterior, [name]: undefined }));
    setMensagem('');
  }

  async function salvar() {
    setErros({});
    setErroGeral('');
    setMensagem('');
    setSalvando(true);

    try {
      const resposta = await fetch('/api/fornecedor/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campos,
          raioAtendimentoKm: Number(campos.raioAtendimentoKm),
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setStatus((anterior) => ({ ...anterior, verificacao: dados.statusVerificacao }));
        setMensagem(
          dados.voltouParaVerificacao
            ? 'Alterações salvas. Como você mudou dados da vitrine, seu perfil voltou para verificação.'
            : 'Alterações salvas.'
        );
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

  async function alterarDisponibilidade(acao) {
    setErroGeral('');
    try {
      const resposta = await fetch('/api/fornecedor/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroGeral(dados.erro ?? 'Não foi possível alterar o status.');
        return;
      }
      setStatus((anterior) => ({ ...anterior, fornecedor: dados.statusFornecedor }));
      setMensagem(
        dados.statusFornecedor === 'pausado'
          ? 'Seu perfil está pausado e não aparece para novos clientes.'
          : 'Seu perfil voltou a aparecer para os clientes.'
      );
    } catch {
      setErroGeral('Falha de conexão. Tente novamente.');
    }
  }

  if (erroGeral && !campos) {
    return <main className="mx-auto max-w-xl p-6"><p className="text-sm text-red-600">{erroGeral}</p></main>;
  }

  if (!campos) {
    return <main className="mx-auto max-w-xl p-6"><p className="text-sm text-slate-600">Carregando...</p></main>;
  }

  const ehPF = status.tipoPessoa === 'PF';
  const documentoEditavel = status.verificacao !== 'aprovado';
  const avisoImutavel = 'Imutável após a aprovação da verificação.';

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Meu perfil</h1>
        <div className="flex flex-wrap gap-2">
          <Etiqueta tom={TOM_VERIFICACAO[status.verificacao]} contorno>
            {ROTULO_VERIFICACAO[status.verificacao]}
          </Etiqueta>
          {status.fornecedor === 'pausado' && (
            <Etiqueta tom="neutro" contorno>perfil pausado</Etiqueta>
          )}
        </div>
      </div>

      {status.motivoRejeicao && status.verificacao !== 'aprovado' && (
        <div className="mb-6 rounded-lg bg-perigo-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-perigo-700">
            Motivo da última rejeição
          </p>
          <p className="mt-1 text-slate-700">{status.motivoRejeicao}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* RN067 — a foto é dado da vitrine: trocá-la reenvia o perfil à
            verificação, e a tela reflete isso na hora. */}
        <FotoPerfil
          fotoAtual={fotoPerfil}
          nome={campos.nomeExibicao || campos.nome}
          avisoVerificacao
          aoAlterar={(dados) => {
            setFotoPerfil(dados.fotoPerfil);
            if (dados.voltouParaVerificacao) {
              setStatus((anterior) => ({ ...anterior, verificacao: 'pendente' }));
            }
          }} />

        <p className="pt-2 text-sm font-medium text-slate-700">Dados do responsável</p>

        <Campo label="Nome" name="nome" value={campos.nome}
          onChange={aoDigitar} erro={erros.nome} />

        <Campo label="Telefone com DDD" name="telefone" value={campos.telefone}
          onChange={aoDigitar} erro={erros.telefone} />

        <p className="pt-2 text-sm font-medium text-slate-700">Dados do negócio</p>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-medium">Tipo de pessoa: </span>
          {ehPF ? 'Pessoa física' : 'Pessoa jurídica'}
          <p className="mt-1 text-xs text-slate-500">Não pode ser alterado.</p>
        </div>

        {ehPF ? (
          <>
            <Campo label="CPF" name="cpf" value={campos.cpf} onChange={aoDigitar}
              erro={erros.cpf} disabled={!documentoEditavel}
              dica={documentoEditavel ? null : avisoImutavel} />
            <Campo label="Data de nascimento" name="dataNascimento" type="date"
              max={dataMaximaNascimento()}
              value={campos.dataNascimento} onChange={aoDigitar}
              erro={erros.dataNascimento} disabled={!documentoEditavel}
              dica={documentoEditavel
                ? `É necessário ter ao menos ${IDADE_MINIMA} anos completos.`
                : avisoImutavel} />
          </>
        ) : (
          <>
            <Campo label="CNPJ" name="cnpj" value={campos.cnpj} onChange={aoDigitar}
              erro={erros.cnpj} disabled={!documentoEditavel}
              dica={documentoEditavel ? null : avisoImutavel} />
            <Campo label="Razão social" name="razaoSocial" value={campos.razaoSocial}
              onChange={aoDigitar} erro={erros.razaoSocial} />
          </>
        )}

        <Campo label="Nome de exibição" name="nomeExibicao" value={campos.nomeExibicao}
          onChange={aoDigitar} erro={erros.nomeExibicao} />

        <div>
          <label htmlFor="descricao" className="mb-1.5 block text-sm font-medium text-slate-700">
            Descrição
          </label>
          <textarea id="descricao" name="descricao" rows={4} value={campos.descricao}
            onChange={aoDigitar}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:border-festa-600 focus:outline-none focus:ring-2 focus:ring-festa-600/30" />
          {erros.descricao && <p className="mt-1 text-sm text-red-600">{erros.descricao}</p>}
        </div>

        <Campo label="Instagram" name="instagramUrl" value={campos.instagramUrl}
          onChange={aoDigitar} erro={erros.instagramUrl} placeholder="https://..." />

        <Campo label="WhatsApp" name="whatsappUrl" value={campos.whatsappUrl}
          onChange={aoDigitar} erro={erros.whatsappUrl} placeholder="https://..." />

        <Campo label="Site" name="site" value={campos.site}
          onChange={aoDigitar} erro={erros.site} placeholder="https://..." />

        <p className="text-xs text-slate-500">
          Alterar foto, nome de exibição, descrição, razão social ou redes sociais envia
          seu perfil para nova verificação.
        </p>

        <p className="pt-2 text-sm font-medium text-slate-700">Área de atendimento</p>

        <div>
          <label htmlFor="estado" className="mb-1.5 block text-sm font-medium text-slate-700">
            Estado
          </label>
          <select id="estado" name="estado" value={campos.estado}
            onChange={aoDigitar} className={CLASSE_SELECT}>
            <option value="">Selecione</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {erros.estado && <p className="mt-1 text-sm text-red-600">{erros.estado}</p>}
        </div>

        <Campo label="Cidade" name="cidade" value={campos.cidade}
          onChange={aoDigitar} erro={erros.cidade} />

        <Campo label="Raio de atendimento (km)" name="raioAtendimentoKm" type="number"
          min="1" max="200" value={campos.raioAtendimentoKm}
          onChange={aoDigitar} erro={erros.raioAtendimentoKm} />

        {/* RF066 — a sede a partir da qual o raio é medido. Alterá-la não
            submete o perfil a nova verificação (RN067). */}
        <MinhaLocalizacao
          coordenadas={coordenadas}
          descricao="Define a partir de onde seu raio de atendimento é medido na busca." />

        {mensagem && <p className="text-sm text-sucesso-700">{mensagem}</p>}
        {erroGeral && <p className="text-sm text-red-600">{erroGeral}</p>}

        <button type="button" onClick={salvar} disabled={salvando}
          className="w-full rounded-lg bg-festa-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-festa-700 disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <p className="text-sm font-medium text-slate-700">Disponibilidade</p>
          <p className="mt-1 text-sm text-slate-600">
            Pausar esconde seu perfil de novos clientes. Seus dados, serviços e
            histórico continuam guardados.
          </p>
          <button type="button"
            onClick={() => alterarDisponibilidade(status.fornecedor === 'pausado' ? 'reativar' : 'pausar')}
            className="mt-3 rounded-lg border border-festa-600 px-3 py-1.5 text-sm font-medium text-festa-700 transition-colors hover:bg-festa-50">
            {status.fornecedor === 'pausado' ? 'Reativar meu perfil' : 'Pausar meu perfil'}
          </button>
        </div>
      </div>
    </main>
  );
}
