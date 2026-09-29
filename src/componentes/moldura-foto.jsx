// Moldura da foto do serviço, com o mesmo destino para quando não há foto:
// o padrão de festa, em vez de um ícone cinza sobre fundo chapado.
//
// Vale a pena existir como componente porque o caso "sem foto" aparece em
// cinco telas — busca, favoritos, vitrine, solicitações e pagamento — e
// antes cada uma resolvia do seu jeito. Agora o serviço sem foto tem a
// mesma cara em todas.
//
// O padrão entra como background e não como <img> porque é decoração: um
// <img> pediria alt, e um alt para "nenhuma foto ainda" seria ruído no
// leitor de tela, que já ouve o nome do serviço logo ao lado. Como cover,
// cada moldura mostra um pedaço diferente do desenho e nunca aparece
// emenda — o padrão não é montado para ladrilhar.
const FUNDO_PADRAO = {
  backgroundImage: 'url(/padrao-festa.webp)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

// A moldura nunca tem altura própria: quem manda é o className de quem a
// usa — uma proporção (aspect-[4/3]) ou a altura da linha em que ela está.
// Por isso a camada da imagem é absoluta. Solta no fluxo, a <img> levaria
// a altura natural dela para a conta do flex e esticaria a linha inteira:
// foi o que fez a foto em pé ficar mais alta que o texto ao lado.
export default function MolduraFoto({
  foto, alt = '', className = '', esmaecida = false, children,
}) {
  return (
    <div className={`relative overflow-hidden bg-festa-50 ${className}`}>
      {/* O esmaecido fica nesta camada, e não na moldura inteira: as
          sobreposições são informação (a categoria, na busca) e precisam
          continuar legíveis mesmo quando a foto desbota. */}
      <div
        className={`absolute inset-0 ${esmaecida ? 'opacity-50' : ''}`}
        style={foto ? undefined : FUNDO_PADRAO}
      >
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={alt} className="h-full w-full object-cover" />
        )}
      </div>

      {children}
    </div>
  );
}
