import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import './help.css';
import './forest.css';
import './overrides.css';
import 'tippy.js/dist/tippy.css';
import './tippy-overrides.css';

mount(App, { target: document.getElementById('app')! });
