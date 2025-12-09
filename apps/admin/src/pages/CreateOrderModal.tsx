import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { fetchSelectableNodes, createOrder, CreateOrderPayload, SelectableNodes } from '../services/orderService';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void; // 成功后回调，用于刷新列表
}

const CreateOrderModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [nodes, setNodes] = useState<SelectableNodes>({ warehouses: [], addresses: [] });

    // 组件加载时，获取仓库和地址列表
    useEffect(() => {
        const loadNodes = async () => {
            try {
                const res = await fetchSelectableNodes();
                if (res.code === 200) {
                    setNodes(res.data);
                }
            } catch (e) {
                console.error("获取节点失败", e);
            }
        };
        loadNodes();
    }, []);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // 构造符合后端要求的 payload
            const payload: CreateOrderPayload = {
                customer: {
                    name: values.customerName,
                    phone: values.customerPhone,
                    address: values.customerAddress,
                },
                amount: values.amount,
                startNodeId: values.startNodeId,
                endNodeId: values.endNodeId,
                serviceLevel: values.serviceLevel,
            };

            const res = await createOrder(payload);
            if (res.code === 200) {
                message.success('订单创建成功！');
                form.resetFields();
                onSuccess(); // 调用父组件的成功回调
            } else {
                message.error(res.msg || '创建失败');
            }
        } catch (errorInfo) {
            console.log('表单校验失败:', errorInfo);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="创建新订单"
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={loading}
            destroyOnClose
        >
            <Form form={form} layout="vertical" name="create_order" preserve={false}>
                <Form.Item name="customerName" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="customerPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                    <Input />
                </Form.Item>
                <Form.Item name="customerAddress" label="收货地址详情" rules={[{ required: true, message: '请输入收货地址' }]}>
                    <Input.TextArea />
                </Form.Item>
                <Form.Item name="amount" label="订单金额" rules={[{ required: true, message: '请输入订单金额' }]}>
                    <InputNumber prefix="¥" style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="serviceLevel" label="服务等级" initialValue="STANDARD" rules={[{ required: true, message: '请选择服务等级' }]}>
                    <Select>
                        <Select.Option value="STANDARD">🚚 普快 (陆运)</Select.Option>
                        <Select.Option value="EXPRESS">🚀 特快 (空运)</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name="startNodeId" label="发货仓库" rules={[{ required: true, message: '请选择发货仓库' }]}>
                    <Select placeholder="选择一个仓库">
                        {nodes.warehouses.map(node => (
                            <Select.Option key={node.id} value={node.id}>{node.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="endNodeId" label="收货地址节点" rules={[{ required: true, message: '请选择收货地址' }]}>
                    <Select placeholder="选择一个收货地址">
                        {nodes.addresses.map(node => (
                            <Select.Option key={node.id} value={node.id}>{node.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateOrderModal;