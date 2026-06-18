// Lê e grava as opções em chrome.storage.local. A chave fica só na máquina do usuário.

const DEFAULTS = { useClaude: false, apiKey: "", model: "claude-haiku-4-5" };

const useClaude = document.getElementById("useClaude");
const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const saved = document.getElementById("saved");

chrome.storage.local.get(DEFAULTS, (s) => {
  useClaude.checked = s.useClaude;
  apiKey.value = s.apiKey;
  model.value = s.model;
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.local.set(
    { useClaude: useClaude.checked, apiKey: apiKey.value.trim(), model: model.value },
    () => {
      saved.classList.remove("hidden");
      setTimeout(() => saved.classList.add("hidden"), 1500);
    }
  );
});
