// Prepara o Node para rodar os testes do Festeirinho.
//
// Os módulos do sistema importam uns aos outros por '@/lib/…', o atalho que
// o Next.js resolve sozinho (jsconfig.json). Fora do Next, o Node não sabe
// o que é '@/'. Este arquivo registra um tradutor de caminhos, e o
// `npm test` o carrega antes de qualquer teste com `--import`.
import { register } from 'node:module';

register('./resolver.mjs', import.meta.url);
