import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Raiz do projeto explícita (há um package-lock.json solto na pasta pessoal que confundia o build)
  turbopack: { root: process.cwd() },
  // Endereço antigo da landing estática continua funcionando
  async redirects() {
    return [{ source: "/virtualstore.html", destination: "/virtualstore", permanent: true }];
  },
  experimental: {
    // Na Hostinger o servidor informa 64 núcleos e o build tenta abrir 63 processos,
    // estourando o limite da conta (mesmo ajuste usado na loja).
    cpus: 2,
  },
};

export default nextConfig;
