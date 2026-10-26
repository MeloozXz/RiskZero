# Guia de Provisionamento e Configuração do Servidor WireGuard — SeguranApp

Este guia técnico detalha o passo a passo para implantar, proteger e operar um servidor VPN WireGuard real em uma Virtual Private Server (VPS) Linux (Ubuntu 22.04 LTS / 24.04 LTS ou Debian 12), e conectá-lo de forma segura aos clientes Android do **SeguranApp**.

---

## 1. Requisitos de Infraestrutura

| Requisito | Recomendação Mínima | Recomendação Ideal (Produção) |
|---|---|---|
| **Sistema Operacional** | Ubuntu 22.04+ / Debian 12 | Ubuntu 24.04 LTS |
| **CPU / RAM** | 1 vCPU / 1 GB RAM | 2 vCPUs / 2 GB RAM |
| **Banda de Rede** | 100 Mbps ilimitada | 1 Gbps / Tráfego não medido |
| **IP Público** | 1 IPv4 Estático dedicado | IPv4 Estático + Bloco IPv6 `/64` |
| **Porta UDP** | `51820` (ou porta personalizada) | `51820` aberta no Security Group |

---

## 2. Instalação do WireGuard e Ferramentas de Rede

Conecte-se à sua VPS via SSH e execute:

```bash
# Atualize o sistema
sudo apt update && sudo apt upgrade -y

# Instale o WireGuard, ferramentas de firewall (iptables/ufw) e qrencode
sudo apt install -y wireguard wireguard-tools iptables ufw qrencode curl
```

---

## 3. Habilitação de Roteamento de Pacotes (IP Forwarding)

Para que o servidor roteie o tráfego dos clientes para a Internet pública:

```bash
# Habilita IP forwarding no kernel
sudo sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
sudo sysctl -w net.ipv4.ip_forward=1

# Opcional (se utilizar IPv6):
sudo sed -i 's/#net.ipv6.conf.all.forwarding=1/net.ipv6.conf.all.forwarding=1/' /etc/sysctl.conf
sudo sysctl -w net.ipv6.conf.all.forwarding=1

# Aplica as configurações
sudo sysctl -p
```

---

## 4. Geração de Chaves Criptográficas do Servidor

O WireGuard utiliza criptografia assimétrica de curva elíptica **Curve25519**.

```bash
# Criar diretório seguro para chaves (permissão restrita)
sudo mkdir -p /etc/wireguard
cd /etc/wireguard
sudo umask 077

# Gerar par de chaves do servidor
wg genkey | sudo tee server_private.key | wg pubkey | sudo tee server_public.key
```

> [!CAUTION]
> **NUNCA** compartilhe, envie ou insira o conteúdo de `server_private.key` no aplicativo móvel ou no repositório Git. Apenas a chave pública (`server_public.key`) é informada aos clientes.

Para visualizar as chaves geradas:
```bash
echo "Chave Privada do Servidor (Mantenha Secreta): $(sudo cat server_private.key)"
echo "Chave Pública do Servidor (Informada ao SeguranApp): $(sudo cat server_public.key)"
```

---

## 5. Configuração da Interface do Servidor (`/etc/wireguard/wg0.conf`)

Descubra o nome da interface física de rede da sua VPS (geralmente `eth0`, `ens3` ou `ens192`):
```bash
ip -o route get 8.8.8.8 | awk '{print $5}'
# Exemplo retornado: eth0
```

Crie o arquivo de configuração `/etc/wireguard/wg0.conf`:

```ini
[Interface]
# Endereço IP do servidor na rede privada da VPN (Subnet /24)
Address = 10.14.0.1/24
ListenPort = 51820
PrivateKey = <CONTEÚDO_DE_server_private.key>

# Regras de NAT (Network Address Translation) ao iniciar a interface
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# ==========================================
# CLIENTES / PEERS (Adicione novos clientes abaixo)
# ==========================================

# Exemplo: Cliente SeguranApp #1
# [Peer]
# PublicKey = <CHAVE_PUBLICA_DO_CLIENTE_CURVE25519>
# AllowedIPs = 10.14.0.2/32
```

*(Substitua `eth0` pela sua interface real de rede, caso seja diferente).*

---

## 6. Configuração do Firewall (UFW / Iptables)

```bash
# Permitir SSH (não perca o acesso!)
sudo ufw allow 22/tcp

# Permitir porta UDP do WireGuard
sudo ufw allow 51820/udp

# Habilitar política padrão de encaminhamento
sudo sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

# Ativar o firewall
sudo ufw enable
```

---

## 7. Inicialização e Habilitação do Serviço

```bash
# Iniciar a interface WireGuard wg0
sudo systemctl start wg-quick@wg0

# Habilitar inicialização automática no boot do sistema
sudo systemctl enable wg-quick@wg0

# Verificar status do túnel
sudo wg show
```

A saída de `sudo wg show` deverá exibir a interface `wg0`, a porta de escuta (`51820`) e a chave pública do servidor.

---

## 8. Adicionando um Cliente (Dispositivo SeguranApp)

Cada smartphone com SeguranApp gera seu próprio par de chaves Curve25519 localmente de forma isolada (via Android Keystore / `KeyPair`).

Para autorizar o cliente no servidor:

1. Obtenha a **Chave Pública do Cliente** exibida na tela de detalhes/configuração da VPN no SeguranApp.
2. No servidor Linux, adicione o cliente executando:
   ```bash
   sudo wg set wg0 peer <CHAVE_PUBLICA_DO_CLIENTE> allowed-ips 10.14.0.2/32
   ```
3. Para tornar a adição persistente através de reinicializações, adicione o bloco no final de `/etc/wireguard/wg0.conf`:
   ```ini
   [Peer]
   # Dispositivo Android - Usuário SeguranApp
   PublicKey = <CHAVE_PUBLICA_DO_CLIENTE>
   AllowedIPs = 10.14.0.2/32
   ```

---

## 9. Cadastrando o Servidor no SeguranApp

Na interface do SeguranApp (ou na lista de nós em `src/services/vpn.ts`), insira os parâmetros do servidor:

| Parâmetro | Valor | Descrição |
|---|---|---|
| **Nome** | `VPS Brasil 01` | Nome identificador para a interface |
| **Endpoint** | `203.0.113.15` (seu IP público) | Endereço IP da sua VPS |
| **Porta** | `51820` | Porta UDP configurada |
| **Server Public Key** | `<server_public.key>` | Chave pública do servidor gerada no Passo 4 |
| **Client Address** | `10.14.0.2/32` | Endereço IP atribuído a este cliente |
| **DNS** | `1.1.1.1, 1.0.0.1` | Servidores DNS seguros (ex: Cloudflare / Quad9) |
| **Allowed IPs** | `0.0.0.0/0` | Rota padrão para tunelar todo o tráfego |

---

## 10. Teste e Validação da Conexão

1. No aplicativo SeguranApp, selecione o servidor cadastrado e toque em **"Toque p/ Ativar"**.
2. O Android exibirá o diálogo do sistema (`VpnService.prepare`) perguntando se você autoriza a conexão VPN. Confirme.
3. No servidor, execute:
   ```bash
   sudo wg show
   ```
   Você verá:
   - **peer**: Chave pública do dispositivo
   - **endpoint**: IP da operadora/provedor e porta do celular
   - **latest handshake**: Quantos segundos atrás ocorreu o aperto de mão criptográfico
   - **transfer**: Bytes enviados e recebidos em tempo real

4. No dispositivo Android:
   - O SeguranApp validará se o IP público detectado mudou para o IP da sua VPS.
   - O indicador exibirá: **"CONEXÃO SEGURA • IP MASCARADO: 203.0.113.15"**.

---

## 11. Troubleshooting (Resolução de Problemas Comuns)

### A. Handshake não ocorre (`latest handshake` ausente ou acima de 2 minutos)
* **Causa 1:** Porta UDP `51820` bloqueada no firewall da nuvem (Security Group na AWS, Oracle Cloud, DigitalOcean, Linode, etc.). Certifique-se de liberar a regra de **UDP 51820** de entrada para `0.0.0.0/0`.
* **Causa 2:** Chave pública do cliente não foi adicionada no servidor ou contém caractere incorreto.

### B. Conecta, mas não há navegação na Internet
* **Causa 1:** IP forwarding desabilitado. Execute `sysctl net.ipv4.ip_forward` (deve retornar `1`).
* **Causa 2:** Regra de MASQUERADE no iptables incorreta ou interface de saída incorreta. Verifique a saída de `ip -o route get 8.8.8.8` e ajuste o parâmetro `-o eth0` no arquivo `wg0.conf`.
* **Causa 3:** Problema de DNS. Certifique-se de que o DNS `1.1.1.1` está configurado no cliente.

### C. Revogação de Dispositivo
Para desconectar e revogar um aparelho imediatamente do servidor:
```bash
sudo wg set wg0 peer <CHAVE_PUBLICA_DO_CLIENTE> remove
```
