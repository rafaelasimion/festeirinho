import bcrypt from 'bcryptjs';

// Conferência da senha digitada contra o hash guardado (RNF001). A senha
// original nunca é recuperada: compara-se o hash da digitada com o da
// coluna.
//
// RN044-A — a conta excluída fica sem hash (senha_hash NULL). O
// bcrypt.compare lança erro quando recebe NULL, e a rota responderia 500
// em vez de recusar a credencial; aqui a falta de hash é simplesmente uma
// senha que não confere.
export async function conferirSenha(senha, hash) {
  if (typeof hash !== 'string' || hash === '') return false;
  return bcrypt.compare(String(senha ?? ''), hash);
}
