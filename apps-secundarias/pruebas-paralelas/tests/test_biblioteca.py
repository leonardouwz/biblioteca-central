"""Pruebas de ejemplo: cada una tarda ~1 s (simula E/S, p. ej. una consulta a BD).

En serie: 8 pruebas x 1 s = ~8 s.  Con `pytest -n 4`: ~2 s.
Cada prueba imprime el worker de xdist que la ejecutó (gw0, gw1, ...).
"""
import os
import time

import pytest

LIBROS = {"978-0": "Cien años de soledad", "978-1": "La ciudad y los perros",
          "978-2": "Rayuela", "978-3": "Ficciones"}


def calcular_multa(dias_retraso: int, tarifa: float = 0.5) -> float:
    return max(0, dias_retraso) * tarifa


def lento():
    time.sleep(1)  # ponytail: simula E/S para que se note la ganancia del paralelismo
    print(f"worker={os.environ.get('PYTEST_XDIST_WORKER', 'master')} pid={os.getpid()}")


@pytest.mark.parametrize("isbn", list(LIBROS))
def test_libro_existe(isbn):
    lento()
    assert LIBROS[isbn]


@pytest.mark.parametrize("dias, esperado", [(0, 0), (3, 1.5), (10, 5.0), (-2, 0)])
def test_multa(dias, esperado):
    lento()
    assert calcular_multa(dias) == esperado
