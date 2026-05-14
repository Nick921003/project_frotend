import type { Config } from 'tailwindcss'

export default {
	content: [
		'./components/**/*.{vue,js,ts}',
		'./layouts/**/*.vue',
		'./pages/**/*.vue',
		'./app.vue',
	],
	corePlugins: {
		// 關閉 Tailwind 的 CSS reset（preflight），避免衝突現有全域樣式
		preflight: false,
	},
	theme: {
		extend: {
			// 把現有設計 token 橋接成 Tailwind utilities
			// 這樣你可以用 text-accent、bg-surface 等 class
			colors: {
				bg: 'var(--color-bg)',
				surface: 'var(--color-surface)',
				'surface-alt': 'var(--color-surface-alt)',
				accent: 'var(--color-accent)',
				sage: 'var(--color-sage)',
				warm: 'var(--color-warm)',
				border: 'var(--color-border)',
				'text-primary': 'var(--color-text-primary)',
				'text-secondary': 'var(--color-text-secondary)',
			},
			fontFamily: {
				heading: 'var(--font-heading)',
				body: 'var(--font-body)',
			},
			spacing: {
				'space-1': 'var(--space-1)',
				'space-2': 'var(--space-2)',
				'space-3': 'var(--space-3)',
				'space-4': 'var(--space-4)',
				'space-5': 'var(--space-5)',
				'space-6': 'var(--space-6)',
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
			},
		},
	},
} satisfies Config
