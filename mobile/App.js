import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const OPCOES_DIFICULDADE = ['TEA', 'TDAH', 'TOD', 'OUTROS'];

function criarFilhoVazio() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: '',
    dataNascimento: '', // formato DD/MM/AAAA
    idade: '',
    dificuldades: [],
    outraDificuldade: '',
  };
}

function calcularIdadeDeDataBR(dataStr) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataStr.trim());
  if (!match) return '';

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const ano = parseInt(match[3], 10);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';

  const hoje = new Date();
  const nascimento = new Date(ano, mes - 1, dia);

  if (
    nascimento.getFullYear() !== ano ||
    nascimento.getMonth() !== mes - 1 ||
    nascimento.getDate() !== dia ||
    nascimento > hoje
  ) {
    return '';
  }

  let anos = hoje.getFullYear() - ano;
  const diferencaMeses = hoje.getMonth() - (mes - 1);
  if (diferencaMeses < 0 || (diferencaMeses === 0 && hoje.getDate() < dia)) {
    anos--;
  }

  if (anos < 0) return '';
  if (anos === 0) {
    let meses = (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() - (mes - 1));
    if (hoje.getDate() < dia) meses--;
    return meses <= 0 ? 'Menos de 1 mês' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }

  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

function mensagemErroAuth(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada. Entre em contato com o suporte.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui uma conta cadastrada.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Utilize pelo menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login por e-mail e senha não está habilitado no Firebase.';
    default:
      return 'Não foi possível concluir a operação. Tente novamente.';
  }
}

export default function App() {
  // 'welcome' | 'login' | 'cadastro' | 'cadastro_filhos' | 'home'
  const [telaAtual, setTelaAtual] = useState('welcome');
  const [abaHome, setAbaHome] = useState('inicio'); // 'inicio' | 'apoio' | 'profissionais' | 'mapa' | 'perfil'
  const [editandoFilhosPeloPerfil, setEditandoFilhosPeloPerfil] = useState(false);

  const [nome, setNome] = useState('');
  const [tipos, setTipos] = useState({
    TDAH: false,
    TEA: false,
    TOD: false,
    OUTROS: false,
  });
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [enviandoAuth, setEnviandoAuth] = useState(false);

  // Estado para múltiplos filhos
  const [filhos, setFilhos] = useState([criarFilhoVazio()]);

  // Estado do modo anônimo no perfil
  const [modoAnonimo, setModoAnonimo] = useState(false);

  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTelaAtual((prev) => (prev === 'cadastro_filhos' ? prev : 'home'));
      } else {
        setTelaAtual((prev) =>
          prev === 'home' || prev === 'cadastro_filhos' ? 'welcome' : prev
        );
      }
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, [initializing]);

  const adicionarFilho = () => {
    setFilhos((prev) => [...prev, criarFilhoVazio()]);
  };

  const removerFilho = (id) => {
    setFilhos((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const atualizarCampoFilho = (id, campo, valor) => {
    setFilhos((prev) =>
      prev.map((filho) => {
        if (filho.id !== id) return filho;

        if (campo === 'dataNascimento') {
          const idadeCalculada = calcularIdadeDeDataBR(valor);
          return {
            ...filho,
            dataNascimento: valor,
            idade: idadeCalculada || filho.idade,
          };
        }

        return { ...filho, [campo]: valor };
      })
    );
  };

  const alternarDificuldadeFilho = (id, dificuldade) => {
    setFilhos((prev) =>
      prev.map((filho) => {
        if (filho.id !== id) return filho;
        const existe = filho.dificuldades.includes(dificuldade);
        const novasDificuldades = existe
          ? filho.dificuldades.filter((item) => item !== dificuldade)
          : [...filho.dificuldades, dificuldade];
        return { ...filho, dificuldades: novasDificuldades };
      })
    );
  };

  const abrirEdicaoFilhos = (vindoDoPerfil = false) => {
    setEditandoFilhosPeloPerfil(vindoDoPerfil);
    setTelaAtual('cadastro_filhos');
  };

  const concluirCadastroFilhos = (destinoAba = 'inicio') => {
    setEditandoFilhosPeloPerfil(false);
    setAbaHome(destinoAba);
    setTelaAtual('home');
  };

  const handleLogin = async () => {
    if (enviandoAuth) return;

    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha o e-mail e a senha.');
      return;
    }

    setEnviandoAuth(true);
    try {
      await signInWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      setAbaHome('inicio');
      setTelaAtual('home');
    } catch (error) {
      console.log('Erro no Login:', error.code, error.message);
      Alert.alert('Erro no Login', mensagemErroAuth(error.code));
    } finally {
      setEnviandoAuth(false);
    }
  };

  const handleRegister = async () => {
    if (enviandoAuth) return;

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!nomeLimpo || !emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha nome, e-mail e senha para se cadastrar.');
      return;
    }

    if (senhaLimpa.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setEnviandoAuth(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpo, senhaLimpa);

      try {
        await updateProfile(userCredential.user, { displayName: nomeLimpo });
      } catch (profileError) {
        console.log('Aviso ao atualizar perfil:', profileError.code, profileError.message);
      }

      const tiposSelecionados = Object.keys(tipos).filter((chave) => tipos[chave]);
      console.log('Conta criada:', userCredential.user.uid, 'Tipos:', tiposSelecionados);

      setFilhos([criarFilhoVazio()]);
      setEditandoFilhosPeloPerfil(false);
      Alert.alert(
        'Conta criada!',
        'Agora adicione as informações dos seus filhos para personalizar seu acolhimento.'
      );
      setTelaAtual('cadastro_filhos');
    } catch (error) {
      console.log('Erro ao criar conta:', error.code, error.message);

      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(
          'E-mail já cadastrado',
          'Este e-mail já possui uma conta. Deseja fazer login com ele?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ir para Login',
              onPress: () => {
                setMostrarSenha(false);
                setTelaAtual('login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Erro ao criar conta', mensagemErroAuth(error.code));
      }
    } finally {
      setEnviandoAuth(false);
    }
  };

  const handleSalvarFilhos = () => {
    const filhosValidos = filhos.filter((f) => f.nome.trim().length > 0);

    if (filhosValidos.length === 0) {
      Alert.alert(
        'Atenção',
        'Informe pelo menos o nome de um filho ou toque em "Pular por agora".'
      );
      return;
    }

    const dadosFormatados = filhosValidos.map((f) => ({
      nome: f.nome.trim(),
      dataNascimento: f.dataNascimento.trim(),
      idade: f.idade.trim() || calcularIdadeDeDataBR(f.dataNascimento),
      dificuldades: f.dificuldades,
      outraDificuldade: f.outraDificuldade.trim(),
    }));

    console.log('Filhos cadastrados:', dadosFormatados);
    Alert.alert('Tudo certo!', `${dadosFormatados.length} filho(a)(s) registrado(s) com sucesso.`);
    concluirCadastroFilhos(editandoFilhosPeloPerfil ? 'perfil' : 'inicio');
  };

  const handleLogout = async () => {
    if (enviandoAuth) return;

    setEnviandoAuth(true);
    try {
      await signOut(auth);
      setNome('');
      setTipos({ TDAH: false, TEA: false, TOD: false, OUTROS: false });
      setEmail('');
      setSenha('');
      setMostrarSenha(false);
      setModoAnonimo(false);
      setEditandoFilhosPeloPerfil(false);
      setFilhos([criarFilhoVazio()]);
      setAbaHome('inicio');
      setTelaAtual('welcome');
    } catch (error) {
      console.log('Erro ao sair:', error.code, error.message);
      Alert.alert('Erro ao sair', mensagemErroAuth(error.code));
    } finally {
      setEnviandoAuth(false);
    }
  };

  // TELA 1: BOAS-VINDAS
  if (telaAtual === 'welcome') {
    return (
      <View style={styles.containerWelcome}>
        <View style={styles.imageContainer}>
          <Image
            source={require('./BEMVI_01.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.textContainerWelcome}>
          <Text style={styles.textoAcolhimento}>
            Plataforma de acolhimento, conexão e indicação para mães atípicas,
            criada para fortalecer redes de apoio, facilitar o acesso a profissionais e
            promover inclusão no dia a dia.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.btnSeta}
          onPress={() => setTelaAtual('login')}
        >
          <Ionicons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }

  // TELA 2: LOGIN COM FIREBASE
  if (telaAtual === 'login') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <View style={styles.loginContent}>
          <Text style={styles.loginTitle}>Bemvi</Text>
          <Text style={styles.loginSubtitle}>LOGIN — Entre para aceder à sua rede de apoio.</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o seu e-mail"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.inputSenhaWrapper}>
              <TextInput
                style={styles.inputSenha}
                placeholder="Digite a sua senha"
                placeholderTextColor="#888"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!mostrarSenha}
              />
              <TouchableOpacity
                style={styles.btnOlho}
                onPress={() => setMostrarSenha(!mostrarSenha)}
              >
                <Ionicons
                  name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#3E5C5B"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnLogin, enviandoAuth && styles.btnDesabilitado]}
            onPress={handleLogin}
            disabled={enviandoAuth}
          >
            <Text style={styles.btnLoginText}>
              {enviandoAuth ? 'ENTRANDO...' : 'ACESSAR'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.textoPergunta}>PRIMEIRA VEZ?</Text>

          <TouchableOpacity
            style={styles.btnVerdeDestaque}
            onPress={() => {
              setMostrarSenha(false);
              setTelaAtual('cadastro');
            }}
          >
            <Text style={styles.btnVerdeDestaqueText}>CRIE SUA CONTA AQUI!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnVoltar}
            onPress={() => setTelaAtual('welcome')}
          >
            <Text style={styles.btnVoltarText}>← Voltar</Text>
          </TouchableOpacity>
        </View>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // TELA 2.1: CADASTRO MÃE ATÍPICA
  if (telaAtual === 'cadastro') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <ScrollView contentContainerStyle={styles.scrollCadastro} showsVerticalScrollIndicator={false}>
          <View style={styles.loginContent}>
            <Text style={styles.loginTitle}>CADASTRO</Text>
            <Text style={styles.loginSubtitle}>
              Crie sua conta para fazer parte da comunidade das mães atípicas.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu nome completo"
                placeholderTextColor="#888"
                value={nome}
                onChangeText={setNome}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o seu e-mail"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={styles.inputSenhaWrapper}>
                <TextInput
                  style={styles.inputSenha}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#888"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!mostrarSenha}
                />
                <TouchableOpacity
                  style={styles.btnOlho}
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                >
                  <Ionicons
                    name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="#3E5C5B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnLogin, enviandoAuth && styles.btnDesabilitado]}
              onPress={handleRegister}
              disabled={enviandoAuth}
            >
              <Text style={styles.btnLoginText}>
                {enviandoAuth ? 'CADASTRANDO...' : 'CADASTRAR E ADICIONAR FILHOS'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.textoPergunta}>JÁ TEM CADASTRO?</Text>

            <TouchableOpacity
              style={styles.btnVerdeDestaque}
              onPress={() => {
                setMostrarSenha(false);
                setTelaAtual('login');
              }}
            >
              <Text style={styles.btnVerdeDestaqueText}>REALIZE LOGIN AQUI!</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // TELA 2.2: CADASTRO / EDIÇÃO DOS FILHOS
  if (telaAtual === 'cadastro_filhos') {
    return (
      <SafeAreaView style={styles.containerFilhos}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollFilhos}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.loginContent}>
              <Text style={styles.loginTitle}>SEUS FILHOS</Text>
              <Text style={styles.loginSubtitle}>
                {nome ? `${nome.trim()}, adicione` : 'Adicione'} quantos filhos precisar, com data de nascimento, idade e dificuldades/neurodivergências.
              </Text>

              {filhos.map((filho, index) => (
                <View key={filho.id} style={styles.cardFilho}>
                  <View style={styles.cardFilhoHeader}>
                    <Text style={styles.cardFilhoTitulo}>Filho(a) {index + 1}</Text>
                    {filhos.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removerFilho(filho.id)}
                        style={styles.btnRemoverFilho}
                      >
                        <Ionicons name="trash-outline" size={18} color="#B91C1C" />
                        <Text style={styles.textoRemoverFilho}>Remover</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nome do(a) filho(a)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex.: Lucas"
                      placeholderTextColor="#888"
                      value={filho.nome}
                      onChangeText={(texto) => atualizarCampoFilho(filho.id, 'nome', texto)}
                    />
                  </View>

                  <View style={styles.linhaDataIdade}>
                    <View style={styles.colunaData}>
                      <Text style={styles.inputLabel}>Data de nascimento</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="DD/MM/AAAA"
                        placeholderTextColor="#888"
                        value={filho.dataNascimento}
                        onChangeText={(texto) =>
                          atualizarCampoFilho(filho.id, 'dataNascimento', texto)
                        }
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>

                    <View style={styles.colunaIdade}>
                      <Text style={styles.inputLabel}>Idade</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex.: 7 anos"
                        placeholderTextColor="#888"
                        value={filho.idade}
                        onChangeText={(texto) => atualizarCampoFilho(filho.id, 'idade', texto)}
                      />
                    </View>
                  </View>

                  <View style={styles.tiposContainer}>
                    <Text style={styles.inputLabel}>Dificuldade / Neurodivergência</Text>
                    <View style={styles.chipsWrapper}>
                      {OPCOES_DIFICULDADE.map((opcao) => {
                        const selecionado = filho.dificuldades.includes(opcao);
                        return (
                          <TouchableOpacity
                            key={opcao}
                            style={[styles.chip, selecionado && styles.chipAtivo]}
                            onPress={() => alternarDificuldadeFilho(filho.id, opcao)}
                          >
                            <Text style={[styles.chipTexto, selecionado && styles.chipTextoAtivo]}>
                              {opcao}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Outra dificuldade / observação (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex.: Dislexia, seletividade alimentar, fala..."
                      placeholderTextColor="#888"
                      value={filho.outraDificuldade}
                      onChangeText={(texto) =>
                        atualizarCampoFilho(filho.id, 'outraDificuldade', texto)
                      }
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.btnAdicionarFilho} onPress={adicionarFilho}>
                <Ionicons name="add-circle-outline" size={22} color="#2E7D32" />
                <Text style={styles.btnAdicionarFilhoTexto}>ADICIONAR OUTRO FILHO</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnLogin} onPress={handleSalvarFilhos}>
                <Text style={styles.btnLoginText}>SALVAR E CONTINUAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnVoltar}
                onPress={() =>
                  concluirCadastroFilhos(editandoFilhosPeloPerfil ? 'perfil' : 'inicio')
                }
              >
                <Text style={styles.btnVoltarText}>
                  {editandoFilhosPeloPerfil ? '← Voltar ao perfil' : 'Pular por agora'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // TELA 3: HOME / PAINEL PRINCIPAL & ABAS
  const nomeExibicao = (
    auth.currentUser?.displayName ||
    nome ||
    (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : '') ||
    'MARIA'
  ).toUpperCase();

  const resumoFilhos = (() => {
    const validos = filhos.filter(
      (f) => f.nome.trim() || f.dificuldades.length > 0 || f.outraDificuldade.trim()
    );
    if (validos.length === 0) return 'FILHO, TEA';

    return validos
      .map((f) => {
        const tags = [...f.dificuldades];
        if (f.outraDificuldade.trim()) tags.push(f.outraDificuldade.trim().toUpperCase());
        const sufixo = tags.length > 0 ? tags.join(', ') : 'FILHO(A)';
        return f.nome.trim() ? `${f.nome.trim().toUpperCase()} (${sufixo})` : sufixo;
      })
      .join(' • ');
  })();

  const abrirOpcaoPerfil = (titulo, mensagem) => {
    Alert.alert(titulo, mensagem);
  };

  return (
    <SafeAreaView style={styles.containerHome}>
      {/* Cabeçalho */}
      <View style={styles.headerHome}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Menu Bemvi',
              `Você está em: ${abaHome.toUpperCase()}${modoAnonimo ? ' (Modo Anônimo ativo)' : ''}`
            )
          }
        >
          <Ionicons name="menu-outline" size={28} color="#3E5C5B" />
        </TouchableOpacity>

        {abaHome === 'perfil' ? (
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Notificações', 'Nenhuma nova notificação no momento.')
            }
          >
            <Ionicons name="notifications" size={26} color="#111" />
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.logoTextHome}>Bemvi</Text>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.btnSairTopo}
              disabled={enviandoAuth}
            >
              <Ionicons name="log-out-outline" size={22} color="#B91C1C" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {abaHome === 'perfil' ? (
        <ScrollView
          style={styles.scrollPerfil}
          contentContainerStyle={styles.contentPerfil}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.perfilHeaderCard}>
            <View style={styles.avatarCirculo}>
              <Ionicons
                name={modoAnonimo ? 'eye-off' : 'person'}
                size={44}
                color="#111"
              />
            </View>
            <View style={styles.perfilSaudacaoBox}>
              <Text style={styles.perfilSaudacaoTexto}>
                OLÁ! {modoAnonimo ? 'ANÔNIMA' : nomeExibicao}
              </Text>
              {modoAnonimo && (
                <Text style={styles.perfilSubAnonimo}>
                  Identidade ocultada na comunidade
                </Text>
              )}
            </View>
          </View>

          <View style={styles.faixaFilhoEditar}>
            <Text style={styles.faixaFilhoTexto} numberOfLines={2}>
              {resumoFilhos}
            </Text>
            <TouchableOpacity
              onPress={() => abrirEdicaoFilhos(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.faixaEditarTexto}>EDITAR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listaPerfilContainer}>
            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'HISTÓRICO',
                  'Visualize suas interações, consultas e atividades recentes na plataforma.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>HISTÓRICO</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'PREFERÊNCIA',
                  'Personalize suas preferências de rede de apoio, temas e alertas.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>PREFERÊNCIA</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'ACESSIBILIDADE',
                  'Ajuste recursos de acessibilidade para facilitar seu uso diário.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>ACESSIBILIDADE</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <View style={styles.itemPerfil}>
              <Text style={styles.itemPerfilTexto}>ANÔNIMO</Text>
              <Switch
                value={modoAnonimo}
                onValueChange={setModoAnonimo}
                trackColor={{ false: '#D1D5DB', true: '#111' }}
                thumbColor={modoAnonimo ? '#FFF' : '#111'}
              />
            </View>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'AJUDA',
                  'Acesse orientações de uso e canais de apoio da equipe Bemvi.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>AJUDA</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'SOBRE',
                  'Bemvi — Plataforma de acolhimento, conexão e indicação para mães atípicas.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>SOBRE</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSairPerfil}
              onPress={handleLogout}
              disabled={enviandoAuth}
            >
              <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
              <Text style={styles.btnSairPerfilTexto}>
                {enviandoAuth ? 'SAINDO...' : 'SAIR DA CONTA'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <Text style={styles.subtitleHome}>Você não está sozinha.</Text>

          <ScrollView
            style={styles.scrollHome}
            contentContainerStyle={styles.contentHome}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={[styles.mainButton, styles.btnBlue]}
              onPress={() => setAbaHome('apoio')}
            >
              <Ionicons name="heart-outline" size={20} color="#222" style={styles.btnIcon} />
              <Text style={styles.buttonText}>PRECISO CONVERSAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainButton, styles.btnGreen]}
              onPress={() => setAbaHome('profissionais')}
            >
              <Ionicons name="medkit-outline" size={20} color="#222" style={styles.btnIcon} />
              <Text style={styles.buttonText}>ENCONTRAR PROFISSIONAIS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainButton, styles.btnYellow]}
              onPress={() => setAbaHome('mapa')}
            >
              <Ionicons name="location-outline" size={20} color="#222" style={styles.btnIcon} />
              <Text style={styles.buttonText}>MAPA INCLUSIVO</Text>
            </TouchableOpacity>

            <View style={styles.quickAccessContainer}>
              <Text style={styles.quickAccessTitle}>ACESSO RÁPIDO</Text>
              <View style={styles.cardRow}>
                <TouchableOpacity style={styles.card}>
                  <Ionicons name="bookmark-outline" size={22} color="#3E5C5B" />
                  <Text style={styles.cardLabel}>Favoritos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card}>
                  <Ionicons name="calendar-outline" size={22} color="#3E5C5B" />
                  <Text style={styles.cardLabel}>Agenda</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card}>
                  <Ionicons name="book-outline" size={22} color="#3E5C5B" />
                  <Text style={styles.cardLabel}>Guias</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </>
      )}

      {/* Barra de Ícones Fixa no Fim da Tela */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('inicio')}
        >
          <Ionicons
            name={abaHome === 'inicio' ? 'home' : 'home-outline'}
            size={22}
            color={abaHome === 'inicio' ? '#111' : '#333'}
          />
          <Text style={[styles.tabText, abaHome === 'inicio' && styles.tabTextAtivo]}>
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('apoio')}
        >
          <Ionicons
            name={abaHome === 'apoio' ? 'heart' : 'heart-outline'}
            size={22}
            color={abaHome === 'apoio' ? '#111' : '#333'}
          />
          <Text style={[styles.tabText, abaHome === 'apoio' && styles.tabTextAtivo]}>
            Apoio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('profissionais')}
        >
          <Ionicons
            name={abaHome === 'profissionais' ? 'medkit' : 'medkit-outline'}
            size={22}
            color={abaHome === 'profissionais' ? '#111' : '#333'}
          />
          <Text style={[styles.tabText, abaHome === 'profissionais' && styles.tabTextAtivo]}>
            Profissionais
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('mapa')}
        >
          <Ionicons
            name={abaHome === 'mapa' ? 'map' : 'map-outline'}
            size={22}
            color={abaHome === 'mapa' ? '#111' : '#333'}
          />
          <Text style={[styles.tabText, abaHome === 'mapa' && styles.tabTextAtivo]}>
            Mapa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('perfil')}
        >
          <Ionicons
            name={abaHome === 'perfil' ? 'person' : 'person-outline'}
            size={22}
            color={abaHome === 'perfil' ? '#111' : '#333'}
          />
          <Text style={[styles.tabText, abaHome === 'perfil' && styles.tabTextAtivo]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWelcome: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  imageContainer: {
    alignItems: 'center',
  },

  logo: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
  },

  textContainerWelcome: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
  },

  textoAcolhimento: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3E5C5B',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.5,
  },

  btnSeta: {
    backgroundColor: '#000',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  containerLogin: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  containerFilhos: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    paddingHorizontal: 20,
  },

  scrollCadastro: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  scrollFilhos: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 36,
  },

  loginContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E5C5B',
    marginBottom: 8,
  },

  loginSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },

  cardFilho: {
    backgroundColor: '#EFECE2',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },

  cardFilhoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  cardFilhoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E5C5B',
  },

  btnRemoverFilho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  textoRemoverFilho: {
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
  },

  linhaDataIdade: {
    flexDirection: 'row',
    gap: 10,
  },

  colunaData: {
    flex: 1.4,
  },

  colunaIdade: {
    flex: 1,
  },

  inputContainer: {
    marginBottom: 14,
    width: '100%',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E5C5B',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },

  inputSenhaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
  },

  inputSenha: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },

  btnOlho: {
    paddingHorizontal: 14,
  },

  tiposContainer: {
    marginBottom: 14,
    width: '100%',
  },

  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3E5C5B',
    backgroundColor: '#FFF',
  },

  chipAtivo: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },

  chipTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E5C5B',
  },

  chipTextoAtivo: {
    color: '#FFF',
  },

  btnAdicionarFilho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },

  btnAdicionarFilhoTexto: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.4,
  },

  btnLogin: {
    backgroundColor: '#3E5C5B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },

  btnDesabilitado: {
    opacity: 0.65,
  },

  btnLoginText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.8,
  },

  textoPergunta: {
    textAlign: 'center',
    color: '#3E5C5B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 8,
  },

  btnVerdeDestaque: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  btnVerdeDestaqueText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  btnVoltar: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },

  btnVoltarText: {
    color: '#3E5C5B',
    fontSize: 15,
    fontWeight: '600',
  },

  containerHome: {
    flex: 1,
    backgroundColor: '#F5F5DC',
  },

  headerHome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 45 : 15,
    paddingBottom: 8,
    backgroundColor: '#FFF',
  },

  btnSairTopo: {
    padding: 4,
  },

  logoTextHome: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E5C5B',
  },

  subtitleHome: {
    textAlign: 'center',
    fontSize: 14,
    color: '#444',
    marginTop: 10,
    marginBottom: 20,
  },

  scrollHome: {
    flex: 1,
  },

  contentHome: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },

  mainButton: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  btnIcon: {
    marginRight: 8,
  },

  btnBlue: {
    backgroundColor: '#7A9AAB',
  },

  btnGreen: {
    backgroundColor: '#5CD662',
  },

  btnYellow: {
    backgroundColor: '#F3C562',
  },

  buttonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  quickAccessContainer: {
    width: '100%',
    marginTop: 15,
  },

  quickAccessTitle: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
    fontWeight: '600',
  },

  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  card: {
    width: '31%',
    height: 80,
    backgroundColor: '#DDD7CC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardLabel: {
    fontSize: 12,
    color: '#3E5C5B',
    fontWeight: '600',
    marginTop: 6,
  },

  scrollPerfil: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  contentPerfil: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 28,
  },

  perfilHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 24,
  },

  avatarCirculo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },

  perfilSaudacaoBox: {
    flex: 1,
  },

  perfilSaudacaoTexto: {
    fontSize: 20,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  perfilSubAnonimo: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
    fontWeight: '600',
  },

  faixaFilhoEditar: {
    backgroundColor: '#C5A55A',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 26,
  },

  faixaFilhoTexto: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  faixaEditarTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    letterSpacing: 0.5,
  },

  listaPerfilContainer: {
    gap: 18,
  },

  itemPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },

  itemPerfilTexto: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.6,
  },

  btnSairPerfil: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },

  btnSairPerfilTexto: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#EAE5DB',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 14 : 10,
    borderTopWidth: 1,
    borderTopColor: '#D8D2C6',
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  tabText: {
    fontSize: 11,
    color: '#555',
    marginTop: 3,
  },

  tabTextAtivo: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
});