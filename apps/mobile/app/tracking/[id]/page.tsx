import TrackingView from '@/components/TrackingView';

interface PageProps {
    params: {
        id: string;
    };
}

export default async function TrackingPage({ params }: PageProps) {
    const { id } = await params;
    return <TrackingView id={id} initialOrder={null} />;
}
