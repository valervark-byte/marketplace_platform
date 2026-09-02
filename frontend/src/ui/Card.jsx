export default function Card({ as: As = 'div', hover = false, className = '', children, ...props }) {
    return (
        <As
            className={
                `rounded-card bg-surface border border-border shadow-card ` +
                (hover
                    ? 'transition-all duration-200 hover:border-border-bright hover:shadow-pop hover:-translate-y-0.5 '
                    : '') +
                className
            }
            {...props}
        >
            {children}
        </As>
    );
}
