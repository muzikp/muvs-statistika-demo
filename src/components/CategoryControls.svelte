<script lang="ts">
  import { onMount } from 'svelte';
  let count = $state(0); let root: HTMLDivElement;
  function read() { try { count = JSON.parse(localStorage.getItem('muvs-statistika-config') || '{}').categories?.length || 0; } catch {} }
  function change(delta: number) { try { const saved = JSON.parse(localStorage.getItem('muvs-statistika-config') || '{}'); const categories = saved.categories || []; if (delta > 0 && categories.length < 12) categories.push({ id: Date.now(), name: `Kategorie ${categories.length + 1}`, weight: 0, color: ['#287766','#b56832','#6676b4','#af5674'][categories.length % 4] }); if (delta < 0 && categories.length > 2) categories.pop(); saved.categories = categories; localStorage.setItem('muvs-statistika-config', JSON.stringify(saved)); location.reload(); } catch {} }
  onMount(() => { read(); const table = document.querySelector('.category-table'); if (table && root) table.after(root); });
</script>
<div class="category-actions" bind:this={root}><button class="add-button" onclick={() => change(1)}>＋ Přidat kategorii</button><button class="text-button" onclick={() => change(-1)} disabled={count <= 2}>− Odebrat poslední</button></div>
