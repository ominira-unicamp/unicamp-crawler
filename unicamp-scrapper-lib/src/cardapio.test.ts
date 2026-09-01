import assert from "node:assert/strict";
import test from "node:test";
import { parseCardapioDia, parseCardapioPortal } from "./cardapio.js";

test("página do portal encontra o iframe do cardápio", () => {
  const result = parseCardapioPortal(
    '<iframe src="https://sistemas.prefeitura.unicamp.br/apps/cardapio/index.php"></iframe>',
    {},
  );
  assert.equal(
    result.menu.url,
    "https://sistemas.prefeitura.unicamp.br/apps/cardapio/index.php",
  );
});

test("página do cardápio separa refeições e observações", () => {
  const result = parseCardapioDia(
    `<section class="menu-section">
      <h2>Almoço</h2>
      <div class="menu-item">
        <div class="menu-item-name">FRANGO ASSADO</div>
        <div class="menu-item-description">
          ARROZ E FEIJÃO<br>
          SALADA<br>
          Observações:<br>
          CONTÉM GLÚTEN.<br>
          <font color="red">Servido no RU.</font>
        </div>
      </div>
    </section>`,
    { url: "https://example.test/menu" },
  );
  assert.deepEqual(result.meals[0].items, ["ARROZ E FEIJÃO", "SALADA"]);
  assert.deepEqual(result.meals[0].observations, ["CONTÉM GLÚTEN."]);
  assert.deepEqual(result.meals[0].serviceNotes, ["Servido no RU."]);
});

test("página do cardápio representa refeição não cadastrada", () => {
  const result = parseCardapioDia(
    `<section class="menu-section">
      <h2>Jantar Vegano</h2>
      <div class="menu-item">Não há jantar vegano cadastrado!</div>
    </section>`,
    { url: "https://example.test/menu" },
  );

  assert.deepEqual(result.meals[0], {
    meal: "dinner",
    label: "Jantar Vegano",
    vegan: true,
    status: "not_registered",
    unavailableMessage: "Não há jantar vegano cadastrado!",
    mainDish: null,
    items: [],
    observations: [],
    serviceNotes: [],
  });
});
