# Statistická laboratoř MÚVS

Výuková Svelte + TypeScript aplikace pro opakovaný výběr z konečné populace. Modul `/ci-alfa-explained` obsahuje dvě větve experimentu:

- populační podíl s kategoriální populací a Wilsonovým/Waldovým intervalem,
- populační střední hodnotu s číselnou populací a intervalem pro průměr.

Nastavení se ukládá do `localStorage` pod klíčem `muvs-statistika-config`, takže lze experiment snadno opakovat při ručním i automatizovaném testování. Simulace běží ve Web Workeru, výsledky drží agregace po dávkách a před spuštěním se zobrazí odhad paměťové náročnosti. Populace střední hodnoty je pro bezpečnost omezena na 100 000 hodnot; aplikace používá pouze lokální výpočty.

```bash
npm install
npm run dev
npm run build
npm test
```

`npm test` může v omezeném prostředí Windows selhat na `spawn EPERM` při startu esbuild/Vite; produkční build je ověřen přes `npm run build`.
