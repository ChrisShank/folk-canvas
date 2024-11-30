interface Weather {
  temperature: string;
  windSpeed: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'folk-weather': FolkWeather;
  }
}

export class FolkWeather extends HTMLElement {
  static tagName = 'folk-weather';

  static define() {
    customElements.define(this.tagName, this);
  }

  static observedAttributes = ['coordinates'];

  #coordinates = [0, 0] as const;
  #results: Weather | null = null;

  get coordinates() {
    return this.#coordinates;
  }

  set coordinates(coordinates) {
    this.setAttribute('coordinates', coordinates.join(', '));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'coordinates') {
      this.#coordinates = newValue.split(',').map((str) => Number(str)) || [0, 0];
      this.fetchWeather(this.#coordinates);
    }
  }

  async fetchWeather([lat, long]: readonly [number, number]) {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: long.toString(),
      current: 'temperature_2m,wind_speed_10m',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
    });
    // https://www.mediawiki.org/wiki/API:Geosearch
    this.#results = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      .then((response) => response.json())
      .then(({ current, current_units }) => ({
        temperature: `${current.temperature_2m} ${current_units.temperature_2m}`,
        windSpeed: `${current.wind_speed_10m} ${current_units.wind_speed_10m}`,
      }));

    this.#renderResults();
  }

  #renderResults() {
    if (this.#results === null) {
      this.innerHTML = '';
      return;
    }
    this.innerHTML = `
      <p>Temperature: ${this.#results.temperature}</p>
      <p>Wind Speed: ${this.#results.windSpeed}</p>
    `;
  }
}
