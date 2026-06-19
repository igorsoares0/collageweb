# Rodando o ambiente de desenvolvimento

Dois projetos: o editor web (`collageweb`, Next.js, roda no WSL) e o app
mobile (`collageapp`, Flutter, roda no Windows com o celular no USB).

## Webapp (terminal WSL/Ubuntu)

```bash
cd /mnt/c/allsaas/collageweb
npm run dev
```

Abrir `http://localhost:3000` no navegador do Windows.

Requisitos: `.env.local` com `DATABASE_URL` (Neon) e
`NEXT_PUBLIC_USE_NEON=true`. Banco novo? `npm run db:init`.

## App mobile no device físico

O celular acessa a API local através do USB, nesta cadeia:

```
app → adb reverse (USB) → ponte IPv4 (Windows) → relay do WSL → next dev
```

A ponte existe porque o relay localhost do WSL só escuta em IPv6 (`::1`)
nesta máquina, e o adb conecta em IPv4 (`127.0.0.1`).

Com o webapp já rodando, em janelas do **cmd** (ou PowerShell):

**1. Túnel adb** (refazer sempre que replugar o USB ou reiniciar):

```cmd
adb reverse tcp:3000 tcp:3000
```

(se `adb` não estiver no PATH:
`C:\Users\igors\AppData\Local\Android\sdk\platform-tools\adb.exe`)

**2. Ponte IPv4** (fica ocupando a janela; deixar aberta):

```cmd
"C:\Program Files\nodejs\node.exe" C:\allsaas\ipv4-bridge.mjs
```

Deve imprimir `bridge ativa: 127.0.0.1:3000 -> [::1]:3000`.

**3. Rodar o app** (outra janela):

```cmd
cd /d C:\allsaas\collageapp
flutter run
```

Não precisa de `API_BASE` — o default é `http://localhost:3000`.
O app já instalado no celular também funciona sem o `flutter run`;
ele só depende dos passos 1 e 2 (e do dev server) para falar com a API.

## Erros de conexão no app

| Sintoma | Causa | Fix |
|---|---|---|
| connection **refused** | túnel adb caiu (replug/reboot) | passo 1 |
| connection **closed before full header** | ponte IPv4 parada | passo 2 |
| timeout / erro genérico | dev server parado | `npm run dev` |

## Alternativa permanente à ponte (opcional)

Num PowerShell **como administrador** (sobrevive a reboot; dispensa o
passo 2 para sempre):

```powershell
netsh interface portproxy add v4tov6 listenaddress=127.0.0.1 listenport=3000 connectaddress=::1 connectport=3000
```

Para desfazer: `netsh interface portproxy delete v4tov6 listenaddress=127.0.0.1 listenport=3000`.
