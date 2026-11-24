import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Raiz do projeto explícita (há um package-lock.json solto na pasta pessoal que confundia o build)
  turbopack: { root: process.cwd() },
  // A landing da VirtualStore é um HTML estático em public/; o endereço limpo aponta para ela.
  async rewrites() {
    return [{ source: "/virtualstore", destination: "/virtualstore.html" }];
  },
  experimental: {
    // Na Hostinger o servidor informa 64 núcleos e o build tenta abrir 63 processos,
    // estourando o limite da conta (mesmo ajuste usado na loja).
    cpus: 2,
  },
};

export default nextConfig;
