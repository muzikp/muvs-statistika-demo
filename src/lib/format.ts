export const number = (value: number, digits = 0) => value.toLocaleString('cs-CZ', { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const percent = (value: number, digits = 1) => `${number(value * 100, digits)} %`;
export const palette = ['#287766', '#b56832', '#6676b4', '#af5674', '#7e8a32', '#448b9d', '#8960a5', '#957447', '#397ec1', '#c1564e', '#626b72', '#906c9c'];
